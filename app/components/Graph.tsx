'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { AnalysisResult } from '@/types';

interface Props {
    data: AnalysisResult;
}

interface Node extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: 'holder' | 'related';
    value: number;
}

interface Link {
    source: string;
    target: string;
    value: number;
    type: 'in' | 'out';
}

interface GraphData {
    nodes: Node[];
    links: Link[];
}

interface Group {
    nodes: Node[];
    totalHolding: number;
}

export default function Graph({ data }: Props) {
    const svgRef = useRef<SVGSVGElement>(null);

    // 转换数据为D3可用格式
    const transformDataForD3 = (analysisData: AnalysisResult): GraphData => {
        const nodes = new Map<string, Node>();
        const links: Link[] = [];

        // 添加持有者节点
        analysisData.topHolders.forEach(holder => {
            nodes.set(holder.holder_address, {
                id: holder.holder_address,
                label: holder.holder_address.substring(0, 4),
                type: 'holder',
                value: 20
            });
        });

        // 处理关联地址和交易
        Object.entries(analysisData.relatedAddresses).forEach(([holderAddress, holderData]) => {
            if (holderData.transactions.length === 0) return;

            // 添加关联地址节点
            const addresses = new Set([
                ...holderData.incomingAddresses,
                ...holderData.outgoingAddresses
            ]);

            addresses.forEach(addr => {
                if (!nodes.has(addr)) {
                    nodes.set(addr, {
                        id: addr,
                        label: addr.substring(0, 4),
                        type: 'related',
                        value: 10
                    });
                }
            });

            // 添加交易连接
            holderData.transactions.forEach(tx => {
                links.push({
                    source: tx.from,
                    target: tx.to,
                    value: tx.amount,
                    type: tx.type
                });
            });
        });

        return {
            nodes: Array.from(nodes.values()),
            links
        };
    };

    // 找出相互关联的持有者群组
    const findHolderGroups = (graphData: GraphData): Group[] => {
        const groups: Group[] = [];
        const visited = new Set<string>();

        // 构建邻接表
        const adjacencyList = new Map<string, Set<string>>();
        graphData.links.forEach(link => {
            if (!adjacencyList.has(link.source)) {
                adjacencyList.set(link.source, new Set());
            }
            if (!adjacencyList.has(link.target)) {
                adjacencyList.set(link.target, new Set());
            }
            adjacencyList.get(link.source)!.add(link.target);
            adjacencyList.get(link.target)!.add(link.source);
        });

        // DFS 查找连通分量
        const dfs = (nodeId: string, group: Set<string>) => {
            visited.add(nodeId);
            group.add(nodeId);

            const neighbors = adjacencyList.get(nodeId) || new Set();
            neighbors.forEach(neighbor => {
                if (!visited.has(neighbor)) {
                    dfs(neighbor, group);
                }
            });
        };

        // 遍历所有持有者节点
        const holderNodes = graphData.nodes.filter(node => node.type === 'holder');
        holderNodes.forEach(holder => {
            if (!visited.has(holder.id)) {
                const group = new Set<string>();
                dfs(holder.id, group);

                // 只保留持有者节点
                const holdersInGroup = Array.from(group)
                    .map(id => graphData.nodes.find(n => n.id === id))
                    .filter(node => node && node.type === 'holder') as Node[];

                // 如果群组中的持有者数量大于等于2，则添加到结果中
                if (holdersInGroup.length >= 2) {
                    // 计算群组总持仓比例
                    const totalHolding = holdersInGroup.reduce((sum, node) => {
                        const holder = data.topHolders.find(h => h.holder_address === node.id);
                        return sum + (holder ? parseFloat(holder.holder_pct_of_supply) : 0);
                    }, 0);

                    groups.push({
                        nodes: holdersInGroup,
                        totalHolding
                    });
                }
            }
        });

        return groups;
    };

    useEffect(() => {
        if (!svgRef.current) return;

        // 清除现有图形
        d3.select(svgRef.current).selectAll('*').remove();

        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height);

        // 添加缩放功能
        const g = svg.append('g');
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // 转换数据
        const graphData = transformDataForD3(data);
        const groups = findHolderGroups(graphData);  // 提前计算群组

        // 创建力导向图
        const simulation = d3.forceSimulation<Node>(graphData.nodes)
            .force('link', d3.forceLink<Node, Link>(graphData.links)
                .id(d => d.id)
                .distance(50))  // 增加连接距离
            .force('charge', d3.forceManyBody()
                .strength(-150)  // 增加排斥力
                .distanceMin(20) // 增加最小距离
                .distanceMax(200)) // 增加最大距离
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide()
                .radius(20)     // 增加碰撞半径
                .strength(0.8)) // 减小碰撞强度，让节点可以稍微重叠
            .force('x', d3.forceX(width / 2).strength(0.05)) // 减小X方向的力
            .force('y', d3.forceY(height / 2).strength(0.05)); // 减小Y方向的力

        // 调整初始布局
        simulation
            .alpha(0.8)        // 减小初始能量
            .alphaDecay(0.02)  // 保持默认衰减率
            .velocityDecay(0.4); // 增加速度衰减，使运动更平滑

        // 创建连接线
        const link = g.append('g')
            .selectAll('line')
            .data(graphData.links)
            .join('line')
            .attr('class', 'link')
            .attr('stroke', d => d.type === 'in' ? '#28a745' : '#dc3545')
            .attr('stroke-width', d => Math.log(d.value + 1) / 2)
            .attr('stroke-opacity', 0.6);

        // 创建节点组
        const node = g.append('g')
            .selectAll('g')
            .data(graphData.nodes)
            .join('g')
            .call(d3.drag<SVGGElement, Node>()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended) as any);

        // 添加节点圆圈
        node.append('circle')
            .attr('r', d => d.value)
            .attr('fill', d => d.type === 'holder' ? '#90EE90' : '#ADD8E6');

        // 添加节点文本
        node.append('text')
            .text(d => d.label)
            .attr('x', 12)
            .attr('y', 4)
            .attr('font-size', '8px');

        // 创建一个群组容器
        const groupContainer = g.append('g').attr('class', 'groups');

        // 更新力导向图
        simulation.on('tick', () => {
            // 更新节点和连接线位置
            node.attr('transform', d => {
                d.x = Math.max(20, Math.min(width - 20, d.x!));
                d.y = Math.max(20, Math.min(height - 20, d.y!));
                return `translate(${d.x},${d.y})`;
            });

            link
                .attr('x1', d => Math.max(20, Math.min(width - 20, (d.source as unknown as Node).x!)))
                .attr('y1', d => Math.max(20, Math.min(height - 20, (d.source as unknown as Node).y!)))
                .attr('x2', d => Math.max(20, Math.min(width - 20, (d.target as unknown as Node).x!)))
                .attr('y2', d => Math.max(20, Math.min(height - 20, (d.target as unknown as Node).y!)));

            // 更新群组标记位置
            groupContainer.selectAll('*').remove();  // 清除旧的群组标记

            groups.forEach((group, index) => {
                const groupNodes = group.nodes;
                const nodePositions = groupNodes.map(n => ({
                    x: n.x || 0,
                    y: n.y || 0
                }));

                // 计算群组的边界
                const minX = Math.min(...nodePositions.map(p => p.x));
                const minY = Math.min(...nodePositions.map(p => p.y));
                const maxX = Math.max(...nodePositions.map(p => p.x));
                const maxY = Math.max(...nodePositions.map(p => p.y));

                // 计算圆的参数
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                const radius = Math.max(
                    Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2)) / 2 + 30,
                    50  // 最小半径
                );

                // 添加群组圆圈
                groupContainer.append('circle')
                    .attr('cx', centerX)
                    .attr('cy', centerY)
                    .attr('r', radius)
                    .attr('fill', 'none')
                    .attr('stroke', '#FF0000')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '5,5')
                    .attr('opacity', 0.5);

                // 添加群组标签
                groupContainer.append('text')
                    .attr('x', centerX)
                    .attr('y', minY - 10)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#FF0000')
                    .attr('font-size', '12px')
                    .text(`Cabel ${index + 1}: ${(group.totalHolding * 100).toFixed(2)}%`);
            });
        });

        // 更新提示框内容
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background-color', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px');

        node
            .on('mouseover', (event, d) => {
                const nodeGroup = groups.find(g => g.nodes.some(n => n.id === d.id));
                const tooltipContent = nodeGroup
                    ? `Address: ${d.id}<br/>Type: ${d.type}<br/>Group Holding: ${(nodeGroup.totalHolding * 100).toFixed(2)}%`
                    : `Address: ${d.id}<br/>Type: ${d.type}`;

                tooltip
                    .style('visibility', 'visible')
                    .html(tooltipContent)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', () => {
                tooltip.style('visibility', 'hidden');
            });

        // 添加拖拽功能
        function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        // 清理函数
        return () => {
            simulation.stop();
            tooltip.remove();
        };
    }, [data]);

    return (
        <div className="w-full h-full min-h-[600px] bg-gray-50 rounded-lg p-4">
            <svg
                ref={svgRef}
                className="w-full h-full"
                style={{ minHeight: '600px' }}
            />
        </div>
    );
}
