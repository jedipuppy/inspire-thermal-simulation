export interface SimulationNode {
  id: string
  name: string
  initialTemp: number
  heatCapacity: number
  isFixed: boolean
  fixedTemp: number
}

export interface SimulationEdge {
  id: string
  source: string
  target: string
  conductance: number
}

export interface SimulationSettings {
  timeStep: number
  totalTime: number
}

export interface SimulationSeries {
  nodeId: string
  name: string
  temperatures: number[]
}

export interface SimulationResult {
  times: number[]
  series: SimulationSeries[]
}

class SimulationError extends Error {}

export function simulateThermalNetwork(
  nodes: SimulationNode[],
  edges: SimulationEdge[],
  settings: SimulationSettings,
): SimulationResult {
  if (!nodes.length) {
    throw new SimulationError('ノードがありません。ノードを追加してください。')
  }

  const { timeStep, totalTime } = settings

  if (!Number.isFinite(timeStep) || timeStep <= 0) {
    throw new SimulationError('時間刻み Δt は正の数で指定してください。')
  }

  if (!Number.isFinite(totalTime) || totalTime <= 0) {
    throw new SimulationError('総シミュレーション時間は正の数で指定してください。')
  }

  if (totalTime < timeStep) {
    throw new SimulationError('総シミュレーション時間は時間刻み Δt 以上にしてください。')
  }

  nodes.forEach((node) => {
    if (!Number.isFinite(node.heatCapacity) || node.heatCapacity <= 0) {
      throw new SimulationError(`${node.name} の熱容量は正の数で指定してください。`)
    }

    if (!Number.isFinite(node.initialTemp)) {
      throw new SimulationError(`${node.name} の初期温度が不正です。`)
    }

    if (node.isFixed && !Number.isFinite(node.fixedTemp)) {
      throw new SimulationError(`${node.name} の固定温度が不正です。`)
    }
  })

  edges.forEach((edge) => {
    if (!Number.isFinite(edge.conductance) || edge.conductance < 0) {
      throw new SimulationError('熱コンダクタンスは 0 以上の数値で指定してください。')
    }
  })

  const nodeIndex = new Map<string, number>()
  nodes.forEach((node, index) => nodeIndex.set(node.id, index))

  edges.forEach((edge) => {
    if (!nodeIndex.has(edge.source) || !nodeIndex.has(edge.target)) {
      throw new SimulationError('存在しないノードを参照する接続があります。')
    }
  })

  const adjacency: Array<Array<{ neighborIndex: number; conductance: number }>> = nodes.map(() => [])

  edges.forEach((edge) => {
    const sourceIndex = nodeIndex.get(edge.source)!
    const targetIndex = nodeIndex.get(edge.target)!

    adjacency[sourceIndex].push({ neighborIndex: targetIndex, conductance: edge.conductance })
    adjacency[targetIndex].push({ neighborIndex: sourceIndex, conductance: edge.conductance })
  })

  const series: SimulationSeries[] = nodes.map((node) => ({
    nodeId: node.id,
    name: node.name,
    temperatures: [],
  }))

  const currentTemps: number[] = nodes.map((node) =>
    node.isFixed ? node.fixedTemp : node.initialTemp,
  )

  series.forEach((s, index) => {
    s.temperatures.push(currentTemps[index])
  })

  const times: number[] = [0]
  let elapsed = 0

  const tolerance = 1e-9

  while (elapsed + tolerance < totalTime) {
    const step = Math.min(timeStep, totalTime - elapsed)
    elapsed += step

    const nextTemps = [...currentTemps]

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]

      if (node.isFixed) {
        nextTemps[i] = node.fixedTemp
        continue
      }

      let netHeatFlow = 0
      const neighbors = adjacency[i]

      for (const { neighborIndex, conductance } of neighbors) {
        const delta = currentTemps[neighborIndex] - currentTemps[i]
        netHeatFlow += conductance * delta
      }

      const temperatureDerivative = netHeatFlow / node.heatCapacity
      nextTemps[i] = currentTemps[i] + temperatureDerivative * step
    }

    for (let i = 0; i < nodes.length; i += 1) {
      currentTemps[i] = nextTemps[i]
      series[i].temperatures.push(currentTemps[i])
    }

    times.push(Number(elapsed.toFixed(6)))
  }

  return { times, series }
}

export { SimulationError }
