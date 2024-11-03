const common = require('oci-common');
const core = require('oci-core');
const identity = require('oci-identity');
const db = require('../database/db');
class InstanceController {
    constructor(configProfile) {
        // 创建认证提供者
        this.provider = new common.SimpleAuthenticationDetailsProvider(
            configProfile.tenancy_ocid,
            configProfile.user_ocid,
            configProfile.fingerprint,
            configProfile.private_key,
            null,
            common.Region.fromRegionId(configProfile.region)
        );

        // 创建计算客户端
        this.computeClient = new core.ComputeClient({
            authenticationDetailsProvider: this.provider
        });

        // 创建VCN客户端
        this.vcnClient = new core.VirtualNetworkClient({
            authenticationDetailsProvider: this.provider
        });

        // 创建身份客户端
        this.identityClient = new identity.IdentityClient({
            authenticationDetailsProvider: this.provider
        });

        // 创建块存储客户端
        this.blockstorageClient = new core.BlockstorageClient({
            authenticationDetailsProvider: this.provider
        });

        // 保存配置
        this.configProfile = configProfile;
    }

    // 创建实例
    async createInstance(details) {
        try {
            const { shape, availability_domain, image_id, boot_volume_size, auth_type, ssh_key, shapeConfig, metadata } = details;

            let instanceDetails = {
                compartmentId: this.configProfile.tenancy_ocid,
                availabilityDomain: availability_domain,
                displayName: `Instance-${Date.now()}`,
                shape: shape,
                sourceDetails: {
                    sourceType: "image",
                    imageId: image_id,
                    bootVolumeSizeInGBs: boot_volume_size
                },
                createVnicDetails: {
                    assignPublicIp: true,
                    subnetId: details.subnet_id || this.configProfile.subnet_id
                },
                metadata: metadata
            };

            if (shapeConfig) {
                instanceDetails.shapeConfig = {
                    ocpus: shapeConfig.ocpus,
                    memoryInGBs: shapeConfig.memoryInGBs
                };
            }

            try {
                const createInstanceResponse = await this.computeClient.launchInstance({
                    launchInstanceDetails: instanceDetails
                });
                return createInstanceResponse.instance;
            } catch (error) {
                // 获取详细错误息
                const errorDetails = {
                    message: error.message,
                    code: error.statusCode,
                    serviceCode: error.serviceCode,
                    requestId: error.opcRequestId,
                    target: error.targetService,
                    timestamp: error.timestamp,
                    endpoint: error.requestEndpoint,
                    details: error.body ? JSON.stringify(error.body) : undefined
                };
                
                console.error('创建实例详细错误:', errorDetails);
                throw errorDetails;
            }
        } catch (error) {
            throw error;
        }
    }

    // 获取实例公网IP
    async getInstanceIp(instanceId) {
        try {
            // 先获取实例状态
            const instance = await this.computeClient.getInstance({
                instanceId: instanceId
            });

            // 如果实例已终止，直接返回 null
            if (instance.instance.lifecycleState === 'TERMINATED') {
                return null;
            }

            // 等待例变为运行状态
            await this.waitForInstanceRunning(instanceId);

            // 获取VNIC附件
            const vnicAttachments = await this.computeClient.listVnicAttachments({
                compartmentId: instance.instance.compartmentId,
                instanceId: instanceId
            });

            if (vnicAttachments.items.length === 0) {
                throw new Error('找不到VNIC附件');
            }

            // 获取VNIC详情
            const vnic = await this.vcnClient.getVnic({
                vnicId: vnicAttachments.items[0].vnicId,
                compartmentId: instance.instance.compartmentId
            });

            return vnic.vnic.publicIp;
        } catch (error) {
            console.error('获取实例IP失败:', error);
            throw error;
        }
    }

    // 等待实例变为运行状态
    async waitForInstanceRunning(instanceId) {
        const maxAttempts = 30;
        const delaySeconds = 10;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const instance = await this.computeClient.getInstance({
                instanceId: instanceId
            });

            if (instance.instance.lifecycleState === 'RUNNING') {
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
            attempts++;
        }

        throw new Error('等待实例运行超时');
    }

    async listInstances() {
        try {
            const instances = await this.computeClient.listInstances({
                compartmentId: this.configProfile.tenancy_ocid
            });
            
            const activeInstances = instances.items.filter(instance => 
                instance.lifecycleState !== 'TERMINATED'
            );
            
            const instanceDetails = await Promise.all(
                activeInstances.map(async (instance) => {
                    try {
                        // 获取VNIC信息
                        const vnicAttachments = await this.computeClient.listVnicAttachments({
                            compartmentId: instance.compartmentId,
                            instanceId: instance.id
                        });
                        
                        let publicIp = null;
                        if (vnicAttachments.items.length > 0) {
                            try {
                                const vnic = await this.vcnClient.getVnic({
                                    vnicId: vnicAttachments.items[0].vnicId,
                                    compartmentId: instance.compartmentId
                                });
                                publicIp = vnic.vnic.publicIp;
                            } catch (vnicError) {
                                console.error(`获取VNIC信息失败: ${vnicError.message}`);
                            }
                        }

                        // 获取启动卷信息
                        const bootVolumes = await this.computeClient.listBootVolumeAttachments({
                            availabilityDomain: instance.availabilityDomain,
                            compartmentId: instance.compartmentId,
                            instanceId: instance.id
                        });

                        let bootVolumeSizeInGBs = '未知';
                        if (bootVolumes.items.length > 0) {
                            const bootVolume = await this.blockstorageClient.getBootVolume({
                                bootVolumeId: bootVolumes.items[0].bootVolumeId
                            });
                            bootVolumeSizeInGBs = bootVolume.bootVolume.sizeInGBs;
                        }
                        
                        return {
                            id: instance.id,
                            displayName: instance.displayName,
                            shape: instance.shape,
                            lifecycleState: instance.lifecycleState,
                            timeCreated: instance.timeCreated,
                            publicIp: publicIp,
                            availabilityDomain: instance.availabilityDomain,
                            ocpus: instance.shapeConfig?.ocpus || '未知',
                            memoryInGBs: instance.shapeConfig?.memoryInGBs || '未知',
                            bootVolumeSizeInGBs: bootVolumeSizeInGBs
                        };
                    } catch (error) {
                        console.error(`获取实例 ${instance.id} 详情失败:`, error);
                        return null;
                    }
                })
            );
            
            return instanceDetails.filter(instance => instance !== null);
        } catch (error) {
            console.error('获取实例列表失败:', error);
            throw error;
        }
    }

    async getPublicIp(instanceId) {
        try {
            const vnicAttachments = await this.computeClient.listVnicAttachments({
                compartmentId: this.configProfile.tenancy_ocid,
                instanceId: instanceId
            });

            if (vnicAttachments.items.length === 0) {
                return null;
            }

            const vnic = await this.vcnClient.getVnic({
                vnicId: vnicAttachments.items[0].vnicId
            });

            return vnic.vnic.publicIp;
        } catch (error) {
            console.error('获取公网IP失败:', error);
            return null;
        }
    }

    async startInstance(instanceId) {
        try {
            await this.computeClient.instanceAction({
                instanceId: instanceId,
                action: 'START'
            });
            await this.logAction(instanceId, 'START', 'SUCCESS', '实例启动成功');
        } catch (error) {
            await this.logAction(instanceId, 'START', 'FAILED', error.message);
            throw error;
        }
    }

    async stopInstance(instanceId) {
        try {
            await this.computeClient.instanceAction({
                instanceId: instanceId,
                action: 'STOP'
            });
            await this.logAction(instanceId, 'STOP', 'SUCCESS', '实例停止成功');
        } catch (error) {
            await this.logAction(instanceId, 'STOP', 'FAILED', error.message);
            throw error;
        }
    }

    async logAction(instanceId, action, status, message) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO instance_logs (instance_id, action, status, message, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            db.run(sql, [instanceId, action, status, message], (err) => {
                if (err) {
                    console.error('记录实例操作失败:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 获取可用的实例类型
    async listShapes() {
        try {
            const shapes = await this.computeClient.listShapes({
                compartmentId: this.configProfile.tenancy_ocid
            });
            return shapes.items;
        } catch (error) {
            console.error('获取实例类型失败:', error);
            throw error;
        }
    }

    // 获取可用域
    async listAvailabilityDomains() {
        try {
            const response = await this.identityClient.listAvailabilityDomains({
                compartmentId: this.configProfile.tenancy_ocid
            });

            return response.items.map(ad => ({
                name: ad.name,
                id: ad.id
            }));
        } catch (error) {
            console.error('获取可用域失败:', error);
            throw error;
        }
    }

    // 取可用的镜像
    async listImages(shape) {
        try {
            const images = await this.computeClient.listImages({
                compartmentId: this.configProfile.tenancy_ocid,
                sortBy: "TIMECREATED",
                sortOrder: "DESC",
                limit: 100
            });

            // 过滤出 Ubuntu 和 CentOS 镜像
            const filteredImages = images.items.filter(image => {
                const os = image.operatingSystem.toLowerCase();
                const isCompatibleOS = os.includes('ubuntu') || os.includes('centos');
                
                const isCompatibleShape = !image.compatibleShapes || 
                    image.compatibleShapes.length === 0 || 
                    image.compatibleShapes.includes(shape);
                
                return isCompatibleOS && isCompatibleShape;
            });

            // 对镜像进行格式化，保持原始displayName
            const formattedImages = filteredImages.map(image => ({
                id: image.id,
                displayName: image.displayName,
                operatingSystem: image.operatingSystem,
                operatingSystemVersion: image.operatingSystemVersion,
                sizeInGBs: image.sizeInGBs || 'N/A',
                timeCreated: image.timeCreated
            }));

            // 按操作系统和创建时间排序
            return formattedImages.sort((a, b) => {
                if (a.operatingSystem < b.operatingSystem) return -1;
                if (a.operatingSystem > b.operatingSystem) return 1;
                return new Date(b.timeCreated) - new Date(a.timeCreated);
            });
        } catch (error) {
            console.error('获取镜像列表失败:', error);
            throw error;
        }
    }

    // 格式化像名称
    formatImageName(image) {
        const os = image.operatingSystem;
        const version = image.operatingSystemVersion;
        
        // 移除不必要的文本
        let simpleName = `${os} ${version}`
            .replace('Canonical Ubuntu', 'Ubuntu')
            .replace('CentOS Linux', 'CentOS')
            .replace(/\s+/g, ' ')
            .trim();

        return simpleName;
    }

    // 生成有效的DNS标签
    generateDnsLabel(prefix) {
        // 移除非字母数字字符，转换为小写
        const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '');
        // 生成6位随机字符串
        const randomStr = Math.random().toString(36).substring(2, 8);
        // 组合并确保长度不超过15
        return (cleanPrefix + randomStr).substring(0, 15);
    }

    // 获取可用的子网列表
    async listSubnets() {
        try {
            const subnets = await this.vcnClient.listSubnets({
                compartmentId: this.configProfile.tenancy_ocid
            });
            return subnets.items;
        } catch (error) {
            console.error('获取子网列表失败:', error);
            throw error;
        }
    }

    // 检查子网是否可用
    async findAvailableSubnet() {
        try {
            const subnets = await this.listSubnets();
            // 返回第一个可用的子网
            return subnets.find(subnet => 
                subnet.lifecycleState === 'AVAILABLE'
            );
        } catch (error) {
            console.error('检查子网失败:', error);
            throw error;
        }
    }

    // 获取或创建网
    async getOrCreateSubnet() {
        try {
            // 先检查是否有可用的子网
            const existingSubnet = await this.findAvailableSubnet();
            if (existingSubnet) {
                console.log('使用现有子网:', existingSubnet.id);
                return existingSubnet.id;
            }

            // 如果没有可用的子网，创建新的网络资源
            console.log('没有找到可用子网，创建新的网络资源');
            return await this.createNetworkStack();
        } catch (error) {
            console.error('获取或创建子网失败:', error);
            throw error;
        }
    }

    // 创建VCN和子网
    async createNetworkStack() {
        try {
            const timestamp = Date.now();
            const dnsLabel = this.generateDnsLabel('vcn');
            const subnetDnsLabel = this.generateDnsLabel('sub');

            // 创建VCN
            const createVcnDetails = {
                compartmentId: this.configProfile.tenancy_ocid,
                cidrBlock: "10.0.0.0/16",
                displayName: `vcn-${timestamp}`,
                dnsLabel: dnsLabel
            };

            const vcn = await this.vcnClient.createVcn({
                createVcnDetails: createVcnDetails
            });

            // 创建Internet Gateway
            const createIgDetails = {
                compartmentId: this.configProfile.tenancy_ocid,
                vcnId: vcn.vcn.id,
                displayName: `ig-${timestamp}`,
                isEnabled: true
            };

            const ig = await this.vcnClient.createInternetGateway({
                createInternetGatewayDetails: createIgDetails
            });

            // 更新路由表
            const routeRules = [
                {
                    networkEntityId: ig.internetGateway.id,
                    destination: "0.0.0.0/0",
                    destinationType: "CIDR_BLOCK"
                }
            ];

            await this.vcnClient.updateRouteTable({
                rtId: vcn.vcn.defaultRouteTableId,
                updateRouteTableDetails: {
                    routeRules: routeRules
                }
            });

            // 创建子网
            const createSubnetDetails = {
                compartmentId: this.configProfile.tenancy_ocid,
                vcnId: vcn.vcn.id,
                cidrBlock: "10.0.0.0/24",
                displayName: `subnet-${timestamp}`,
                dnsLabel: subnetDnsLabel
            };

            const subnet = await this.vcnClient.createSubnet({
                createSubnetDetails: createSubnetDetails
            });

            return subnet.subnet.id;
        } catch (error) {
            console.error('创建网络资源失败:', error);
            throw error;
        }
    }

    // 预定义的实例类型
    getPresetShapes() {
        return [
            {
                shape: 'VM.Standard.A1.Flex',
                displayName: 'Ampere A1 Flex (ARM)',
                ocpus: 1,
                memoryInGBs: 6,
                isFlexible: true
            },
            {
                shape: 'VM.Standard.E2.1.Micro',
                displayName: 'AMD E2.1 Micro (x86)',
                ocpus: 1,
                memoryInGBs: 1,
                isFlexible: false
            }
        ];
    }

    // 根据实例类型获取可用镜像
    async getImagesForShape(shape) {
        try {
            const response = await this.computeClient.listImages({
                compartmentId: this.configProfile.tenancy_ocid,
                shape: shape,
                operatingSystem: 'Canonical Ubuntu',
                operatingSystemVersion: '20.04',
                sortBy: 'TIMECREATED',
                sortOrder: 'DESC'
            });

            return response.items.map(image => ({
                id: image.id,
                displayName: image.displayName,
                operatingSystem: image.operatingSystem,
                operatingSystemVersion: image.operatingSystemVersion,
                timeCreated: image.timeCreated,
                shape: shape
            }));
        } catch (error) {
            console.error('获取镜像表失败:', error);
            throw error;
        }
    }

    // 获取可用区列表
    async getAvailabilityDomains() {
        try {
            const response = await this.identityClient.listAvailabilityDomains({
                compartmentId: this.configProfile.tenancy_ocid
            });

            return response.items.map(ad => ({
                name: ad.name,
                id: ad.id
            }));
        } catch (error) {
            console.error('获取可用区列表失败:', error);
            throw error;
        }
    }

    async terminateInstance(instanceId) {
        try {
            await this.computeClient.terminateInstance({
                instanceId: instanceId,
                preserveBootVolume: false
            });
            await this.logAction(instanceId, 'TERMINATE', 'SUCCESS', '实例删除成功');
        } catch (error) {
            await this.logAction(instanceId, 'TERMINATE', 'FAILED', error.message);
            throw error;
        }
    }

    async resizeInstance(instanceId, { ocpus, memoryInGBs }) {
        try {
            // 先获取实例信息
            const instance = await this.computeClient.getInstance({
                instanceId: instanceId
            });

            // 构建更新信息，保持其他配置不变
            const updateInstanceDetails = {
                shape: instance.shape,
                shapeConfig: {
                    ...instance.shapeConfig,
                    ocpus: ocpus || instance.shapeConfig.ocpus,
                    memoryInGBs: memoryInGBs || instance.shapeConfig.memoryInGBs
                }
            };

            await this.computeClient.updateInstance({
                instanceId: instanceId,
                updateInstanceDetails: updateInstanceDetails
            });

            await this.logAction(
                instanceId, 
                'RESIZE', 
                'SUCCESS', 
                `调整规格为 ${updateInstanceDetails.shapeConfig.ocpus} OCPU, ${updateInstanceDetails.shapeConfig.memoryInGBs} GB`
            );
        } catch (error) {
            await this.logAction(instanceId, 'RESIZE', 'FAILED', error.message);
            throw error;
        }
    }

    async changeInstanceIp(instanceId) {
        try {
            const instance = await this.computeClient.getInstance({
                instanceId: instanceId
            });

            const vnicAttachments = await this.computeClient.listVnicAttachments({
                compartmentId: instance.instance.compartmentId,
                instanceId: instanceId
            });

            if (vnicAttachments.items.length === 0) {
                throw new Error('找不到VNIC附件');
            }

            const vnic = await this.vcnClient.getVnic({
                vnicId: vnicAttachments.items[0].vnicId
            });

            const privateIps = await this.vcnClient.listPrivateIps({
                vnicId: vnic.vnic.id
            });

            if (privateIps.items.length === 0) {
                throw new Error('找不到私有IP');
            }

            const privateIpId = privateIps.items[0].id;

            try {
                // 尝试获取并删除现有的公网IP
                const publicIp = await this.vcnClient.getPublicIpByPrivateIpId({
                    getPublicIpByPrivateIpIdDetails: {
                        privateIpId: privateIpId
                    }
                });

                if (publicIp && publicIp.publicIp) {
                    await this.vcnClient.deletePublicIp({
                        publicIpId: publicIp.publicIp.id
                    });
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            } catch (error) {
                // 如果获取公网IP失败，直接继续创建新的
                console.log('获取现有公网IP失败，将直接创建新的公网IP', error);
            }

            // 创建新的临时公网IP
            await this.vcnClient.createPublicIp({
                createPublicIpDetails: {
                    compartmentId: instance.instance.compartmentId,
                    lifetime: 'EPHEMERAL',
                    privateIpId: privateIpId
                }
            });

            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.logAction(instanceId, 'CHANGE_PUBLIC_IP', 'SUCCESS', '更换公网IP成功');

        } catch (error) {
            await this.logAction(instanceId, 'CHANGE_PUBLIC_IP', 'FAILED', error.message);
            throw error;
        }
    }
}

module.exports = InstanceController;

