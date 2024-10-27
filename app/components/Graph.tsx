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

        // 添加提示框
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

        // 添加节点悬停效果
        node
            .on('mouseover', (event, d) => {
                tooltip
                    .style('visibility', 'visible')
                    .html(`Address: ${d.id}<br/>Type: ${d.type}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', () => {
                tooltip.style('visibility', 'hidden');
            });

        // 更新力导向图
        simulation.on('tick', () => {
            // 限制节点位置在视图范围内
            node.attr('transform', d => {
                d.x = Math.max(20, Math.min(width - 20, d.x!));
                d.y = Math.max(20, Math.min(height - 20, d.y!));
                return `translate(${d.x},${d.y})`;
            });

            // 更新连接线
            link
                .attr('x1', d => Math.max(20, Math.min(width - 20, (d.source as unknown as Node).x!)))
                .attr('y1', d => Math.max(20, Math.min(height - 20, (d.source as unknown as Node).y!)))
                .attr('x2', d => Math.max(20, Math.min(width - 20, (d.target as unknown as Node).x!)))
                .attr('y2', d => Math.max(20, Math.min(height - 20, (d.target as unknown as Node).y!)));
        });

        // 拖拽功能
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
