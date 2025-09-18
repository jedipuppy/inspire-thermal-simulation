import type { ChangeEvent, FormEvent, MouseEvent, PointerEvent } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Plot from 'react-plotly.js'
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  getBezierPath,
} from 'reactflow'
import type { Connection, Edge, EdgeChange, EdgeProps, Node, NodeChange, NodeProps } from 'reactflow'
import type { SimulationResult, SimulationSettings } from './simulation'
import { SimulationError, simulateThermalNetwork } from './simulation'
import initialModelRaw from '../inspire.json?raw'
import styleConfigRaw from './style-config.json?raw'
import './App.css'
import 'reactflow/dist/style.css'

type ThermalNodeData = {
  name: string
  initialTemp: number
  heatCapacity: number
  isFixed: boolean
  fixedTemp: number
  latestTemp?: number
  label: string
}

type ThermalEdgeData = {
  conductance: number
}

type ModelNode = {
  id: string
  name: string
  initialTemp: number
  heatCapacity: number
  isFixed: boolean
  fixedTemp: number
  position: { x: number; y: number }
}

type ModelEdge = {
  id: string
  source: string
  target: string
  conductance: number
}

type ModelFile = {
  nodes: ModelNode[]
  edges: ModelEdge[]
}

type StylePalette = {
  background: string
  border: string
  text: string
}

type StyleConfig = {
  cssVariables: Record<string, string>
  node: {
    default: StylePalette
    fixed: StylePalette
    shape: {
      padding: number
      borderRadius: number
      fontSize: number
      fontWeight: number
      boxShadow: string
    }
  }
  edge: {
    stroke: string
    strokeWidth: number
  }
}

type NewEdgeConfig = {
  sourceId: string
  targetId: string
  conductance: number
}

type NodeEditorContextValue = {
  onFieldChange: <K extends keyof ThermalNodeData>(nodeId: string, key: K, value: ThermalNodeData[K]) => void
  onRemove: (nodeId: string) => void
}

type EdgeEditorContextValue = {
  onConductanceChange: (edgeId: string, value: number) => void
  onRemove: (edgeId: string) => void
}

const NodeEditorContext = createContext<NodeEditorContextValue | null>(null)
const EdgeEditorContext = createContext<EdgeEditorContextValue | null>(null)


const UI_TEXT = {
  headerTitle: '\u591a\u63a5\u70b9\u71b1\u89e3\u6790\u30b7\u30df\u30e5\u30ec\u30fc\u30bf\u30fc',
  headerSubtitle: 'React Flow \u3068 Plotly.js \u3067\u71b1\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u3092\u53ef\u8996\u5316\u30fb\u89e3\u6790',
  nodeManagement: '\u30ce\u30fc\u30c9\u7ba1\u7406',
  addNode: '\u30ce\u30fc\u30c9\u8ffd\u52a0',
  addNodePlaceholder: '\u30ce\u30fc\u30c9\u3092\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
  fieldName: '\u540d\u524d',
  fieldInitialTemp: '\u521d\u671f\u6e29\u5ea6 [\u2103]',
  fieldHeatCapacity: '\u71b1\u5bb9\u91cf [J/K]',
  fieldLockTemperature: '\u6e29\u5ea6\u3092\u56fa\u5b9a',
  fieldFixedTemp: '\u56fa\u5b9a\u6e29\u5ea6 [\u2103]',
  latestTemp: '\u6700\u7d42\u6e29\u5ea6',
  connectionManagement: '\u63a5\u7d9a\u7ba1\u7406',
  nodeA: '\u30ce\u30fc\u30c9 A',
  nodeB: '\u30ce\u30fc\u30c9 B',
  conductance: '\u71b1\u30b3\u30f3\u30c0\u30af\u30bf\u30f3\u30b9 [W/K]',
  addConnection: '\u63a5\u7d9a\u3092\u8ffd\u52a0',
  noConnections: '\u63a5\u7d9a\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093\u3002',
  simulationSettings: '\u30b7\u30df\u30e5\u30ec\u30fc\u30b7\u30e7\u30f3\u8a2d\u5b9a',
  timeStep: '\u6642\u9593\u523b\u307f \u0394t [s]',
  totalTime: '\u89e3\u6790\u6642\u9593 [s]',
  runSimulation: '\u30b7\u30df\u30e5\u30ec\u30fc\u30b7\u30e7\u30f3\u5b9f\u884c',
  jsonEditor: 'JSON \u7de8\u96c6',
  export: '\u30a8\u30af\u30b9\u30dd\u30fc\u30c8',
  import: '\u30a4\u30f3\u30dd\u30fc\u30c8',
  resetPreset: '\u30d7\u30ea\u30bb\u30c3\u30c8\u306b\u623b\u3059',
  graphTitle: '\u6e29\u5ea6\u5c65\u6b74',
  axisTime: '\u6642\u9593 [s]',
  axisTemp: '\u6e29\u5ea6 [\u2103]',
  placeholder: '\u30b7\u30df\u30e5\u30ec\u30fc\u30b7\u30e7\u30f3\u3092\u5b9f\u884c\u3059\u308b\u3068\u6e29\u5ea6\u63a8\u79fb\u3092\u8868\u793a\u3057\u307e\u3059\u3002',
  errorUnexpected: '\u30b7\u30df\u30e5\u30ec\u30fc\u30b7\u30e7\u30f3\u4e2d\u306b\u4e88\u671f\u3057\u306a\u3044\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f\u3002',
  jsonNeedsNodes: 'JSON\u306f nodes \u3068 edges \u3092\u542b\u3080\u5fc5\u8981\u304c\u3042\u308a\u307e\u3059\u3002',
  nodeInvalid: 'nodes[${index}] \u304c\u4e0d\u6b63\u3067\u3059\u3002',
  nodeIdInvalid: 'nodes[${index}].id \u304c\u4e0d\u6b63\u3067\u3059\u3002',
  nodeNameInvalid: 'nodes[${index}].name \u304c\u4e0d\u6b63\u3067\u3059\u3002',
  nodePositionInvalid: 'nodes[${index}].position \u304c\u4e0d\u6b63\u3067\u3059\u3002',
  nodePositionNeedsNumbers: 'nodes[${index}].position \u306b\u6570\u5024\u306e x, y \u304c\u5fc5\u8981\u3067\u3059\u3002',
  edgeInvalid: 'edges[${index}] \u304c\u4e0d\u6b63\u3067\u3059\u3002',
  edgeIdInvalid: 'edges[${index}].id \u304c\u4e0d\u6b63\u3067\u3059\u3002',
  edgeEndpointsInvalid: 'edges[${index}] \u306e source / target \u304c\u4e0d\u6b63\u3067\u3059\u3002',
  jsonParseFailed: 'JSON\u306e\u89e3\u6790\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002',
  delete: '\u524a\u9664',
  arrow: '\u2192',
  degree: '\u2103',
} as const

const numberFormatter = new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const parseJson = <T,>(raw: string): T => {
  const sanitized = raw.replace(/^\uFEFF/, '').trim()
  return JSON.parse(sanitized) as T
}

const styleConfig = parseJson<StyleConfig>(styleConfigRaw)
const initialModel = parseJson<ModelFile>(initialModelRaw)

const withIndex = (template: string, index: number) => template.replace('${index}', String(index))

const applyStyleConfig = (config: StyleConfig) => {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement

  Object.entries(config.cssVariables).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

const createNodeStyle = (data: ThermalNodeData) => {
  const palette = data.isFixed ? styleConfig.node.fixed : styleConfig.node.default

  return {
    background: palette.background,
    border: `2px solid ${palette.border}`,
    color: palette.text,
    borderRadius: styleConfig.node.shape.borderRadius,
    padding: styleConfig.node.shape.padding,
    fontSize: styleConfig.node.shape.fontSize,
    fontWeight: styleConfig.node.shape.fontWeight,
    boxShadow: styleConfig.node.shape.boxShadow,
  }
}

const decorateNode = (node: Node<ThermalNodeData>): Node<ThermalNodeData> => ({
  ...node,
  data: { ...node.data, label: node.data.name },
  style: createNodeStyle(node.data),
})

const buildNodesFromModel = (modelNodes: ModelNode[]): Node<ThermalNodeData>[] =>
  modelNodes.map((modelNode) =>
    decorateNode({
      id: modelNode.id,
      type: 'thermal',
      position: { x: modelNode.position.x, y: modelNode.position.y },
      data: {
        name: modelNode.name,
        initialTemp: modelNode.initialTemp,
        heatCapacity: modelNode.heatCapacity,
        isFixed: modelNode.isFixed,
        fixedTemp: modelNode.fixedTemp,
        latestTemp: undefined,
        label: modelNode.name,
      },
      sourcePosition: Position.Left,
      targetPosition: Position.Right,
    }),
  )

const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`

const createEdge = (
  source: string,
  target: string,
  conductance: number,
  id?: string,
): Edge<ThermalEdgeData> => ({
  id: id ?? randomId('edge'),
  source,
  target,
  type: 'thermal',
  data: { conductance },
  markerEnd: { type: MarkerType.ArrowClosed, color: styleConfig.edge.stroke },
  style: { stroke: styleConfig.edge.stroke, strokeWidth: styleConfig.edge.strokeWidth },
})

const buildEdgesFromModel = (modelEdges: ModelEdge[]): Edge<ThermalEdgeData>[] =>
  modelEdges.map((modelEdge) =>
    createEdge(modelEdge.source, modelEdge.target, modelEdge.conductance, modelEdge.id),
  )

const buildModelFromState = (
  nodes: Node<ThermalNodeData>[],
  edges: Edge<ThermalEdgeData>[],
): ModelFile => ({
  nodes: nodes.map((node) => ({
    id: node.id,
    name: node.data.name,
    initialTemp: node.data.initialTemp,
    heatCapacity: node.data.heatCapacity,
    isFixed: node.data.isFixed,
    fixedTemp: node.data.fixedTemp,
    position: { x: node.position.x, y: node.position.y },
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    conductance: edge.data?.conductance ?? 0,
  })),
})

const computeNextNodeCounter = (nodes: Node<ThermalNodeData>[]) => {
  const pattern = /node-(\d+)/u
  let max = 0

  nodes.forEach((node) => {
    const match = pattern.exec(node.id)

    if (!match) {
      return
    }

    const value = Number.parseInt(match[1], 10)
    if (Number.isFinite(value)) {
      max = Math.max(max, value)
    }
  })

  return max + 1
}

const clearNodeTemperature = (node: Node<ThermalNodeData>) => {
  if (node.data.latestTemp === undefined) {
    return node
  }

  return decorateNode({
    ...node,
    data: { ...node.data, latestTemp: undefined },
  })
}

const deriveEdgeDefaults = (
  nodes: Node<ThermalNodeData>[],
  previous?: NewEdgeConfig,
): NewEdgeConfig => {
  const ids = nodes.map((node) => node.id)
  const conductance = previous?.conductance ?? 1

  if (ids.length === 0) {
    return { sourceId: '', targetId: '', conductance }
  }

  if (ids.length === 1) {
    return { sourceId: ids[0]!, targetId: ids[0]!, conductance }
  }

  const source = previous && ids.includes(previous.sourceId) ? previous.sourceId : ids[0]!
  const candidateTargets = ids.filter((id) => id !== source)
  const targetCandidate =
    previous && ids.includes(previous.targetId) && previous.targetId !== source
      ? previous.targetId
      : candidateTargets[0] ?? ids[0]!

  const target = targetCandidate === source && candidateTargets[0]
    ? candidateTargets[0]
    : targetCandidate

  return { sourceId: source, targetId: target, conductance }
}

const formatNumber = (value: number | undefined) => {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return numberFormatter.format(value)
}

const ThermalNode = ({ id, data, selected }: NodeProps<ThermalNodeData>) => {
  const editor = useContext(NodeEditorContext)

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    editor?.onFieldChange(id, 'name', event.target.value)
  }

  const handleNumericChange = (key: 'initialTemp' | 'heatCapacity' | 'fixedTemp') => (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const parsed = Number(event.target.value)

    if (Number.isNaN(parsed)) {
      return
    }

    editor?.onFieldChange(id, key, parsed as ThermalNodeData[typeof key])
  }

  const handleFixedToggle = (event: ChangeEvent<HTMLInputElement>) => {
    editor?.onFieldChange(id, 'isFixed', event.target.checked)
  }

  const handleRemove = () => {
    editor?.onRemove(id)
  }

  const className = [
    'thermal-node',
    data.isFixed ? 'thermal-node--fixed' : '',
    selected ? 'thermal-node--selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <Handle type="target" position={Position.Left} className="thermal-node__handle thermal-node__handle--left" />
      <Handle type="source" position={Position.Right} className="thermal-node__handle thermal-node__handle--right" />
      <div className="thermal-node__header">
        <input
          className="thermal-node__name"
          value={data.name}
          onChange={handleNameChange}
          onPointerDown={(event) => event.stopPropagation()}
        />
        <button
          type="button"
          className="thermal-node__remove"
          onClick={handleRemove}
          onPointerDown={(event) => event.stopPropagation()}
        >
          x
        </button>
      </div>
      <div className="thermal-node__body">
        <label className="thermal-node__field">
          <span>{UI_TEXT.fieldInitialTemp}</span>
          <input
            type="number"
            step="0.1"
            value={data.initialTemp}
            disabled={data.isFixed}
            onChange={handleNumericChange('initialTemp')}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </label>
        <label className="thermal-node__field">
          <span>{UI_TEXT.fieldHeatCapacity}</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={data.heatCapacity}
            onChange={handleNumericChange('heatCapacity')}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </label>
        <label className="thermal-node__checkbox">
          <input
            type="checkbox"
            checked={data.isFixed}
            onChange={handleFixedToggle}
            onPointerDown={(event) => event.stopPropagation()}
          />
          {UI_TEXT.fieldLockTemperature}
        </label>
        <label className="thermal-node__field">
          <span>{UI_TEXT.fieldFixedTemp}</span>
          <input
            type="number"
            step="0.1"
            value={data.fixedTemp}
            disabled={!data.isFixed}
            onChange={handleNumericChange('fixedTemp')}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </label>
        {data.latestTemp !== undefined && (
          <div className="thermal-node__result">
            {UI_TEXT.latestTemp}: {formatNumber(data.latestTemp)} {UI_TEXT.degree}
          </div>
        )}
      </div>
    </div>
  )
}

const ThermalEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
  selected,
}: EdgeProps<ThermalEdgeData>) => {
  const edgeEditor = useContext(EdgeEditorContext)
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY })
  const conductance = data?.conductance ?? 0
  const transform = 'translate(-50%, -50%) translate(' + labelX + 'px, ' + labelY + 'px)'

  const handleConductanceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value)

    if (Number.isNaN(parsed)) {
      return
    }

    edgeEditor?.onConductanceChange(id, parsed)
  }

  const handleRemove = () => {
    edgeEditor?.onRemove(id)
  }

  const stopPropagation = (event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }

  const className = [
    'thermal-edge-label',
    selected ? 'thermal-edge-label--selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className={className}
          style={{ transform, pointerEvents: 'all' }}
          onPointerDown={stopPropagation}
          onClick={stopPropagation}
        >
          <input
            className="thermal-edge-label__input"
            type="number"
            min="0"
            step="0.1"
            value={conductance}
            onChange={handleConductanceChange}
          />
          <span className="thermal-edge-label__unit">W/K</span>
          <button
            type="button"
            className="thermal-edge-label__button"
            onClick={handleRemove}
          >
            x
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}


const ThermalApp = () => {
  const [nodes, setNodes] = useState<Node<ThermalNodeData>[]>(() => buildNodesFromModel(initialModel.nodes))
  const [edges, setEdges] = useState<Edge<ThermalEdgeData>[]>(() => buildEdgesFromModel(initialModel.edges))
  const [simulationSettings, setSimulationSettings] = useState<SimulationSettings>({
    timeStep: 1,
    totalTime: 120,
  })
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [jsonEditorValue, setJsonEditorValue] = useState(() =>
    JSON.stringify(initialModel, null, 2),
  )
  const [jsonEditorError, setJsonEditorError] = useState('')
  const [newEdgeConfig, setNewEdgeConfig] = useState<NewEdgeConfig>(() =>
    deriveEdgeDefaults(buildNodesFromModel(initialModel.nodes)),
  )

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const nodeIdCounter = useRef(computeNextNodeCounter(nodes))

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    applyStyleConfig(styleConfig)
  }, [])

  const syncModel = useCallback((nextNodes: Node<ThermalNodeData>[], nextEdges: Edge<ThermalEdgeData>[]) => {
    const model = buildModelFromState(nextNodes, nextEdges)
    setJsonEditorValue(JSON.stringify(model, null, 2))
    setJsonEditorError('')
  }, [])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => {
        const next = applyNodeChanges<ThermalNodeData>(changes, prev).map(decorateNode)
        syncModel(next, edgesRef.current)
        return next
      })
    },
    [syncModel],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((prev) => {
        const next = applyEdgeChanges<ThermalEdgeData>(changes, prev)
        syncModel(nodesRef.current, next)
        return next
      })
    },
    [syncModel],
  )

  const nodeOptions = useMemo(
    () => nodes.map((node) => ({ id: node.id, name: node.data.name })),
    [nodes],
  )

  const nodeNameMap = useMemo(() => new Map(nodes.map((node) => [node.id, node.data.name])), [nodes])
  const nodeTypes = useMemo(() => ({ thermal: ThermalNode }), [])
  const edgeTypes = useMemo(() => ({ thermal: ThermalEdge }), [])

  const disableEdgeCreation =
    nodes.length < 2 ||
    !newEdgeConfig.sourceId ||
    !newEdgeConfig.targetId ||
    newEdgeConfig.sourceId === newEdgeConfig.targetId

  const handleAddNode = useCallback(() => {
    const suffix = nodeIdCounter.current
    nodeIdCounter.current += 1

    const newNode = decorateNode({
      id: `node-${suffix}`,
      type: 'thermal',
      position: {
        x: nodesRef.current.length * 160,
        y: 80 + nodesRef.current.length * 40,
      },
      data: {
        name: `Node ${suffix}`,
        initialTemp: 20,
        heatCapacity: 100,
        isFixed: false,
        fixedTemp: 20,
        latestTemp: undefined,
        label: `Node ${suffix}`,
      },
      sourcePosition: Position.Left,
      targetPosition: Position.Right,
    })

    const nextNodes = [...nodesRef.current, newNode]
    setNodes(nextNodes)
    syncModel(nextNodes, edgesRef.current)
    setSimulationResult(null)
    setErrorMessage('')
    setNewEdgeConfig((prev) => deriveEdgeDefaults(nextNodes, prev))
  }, [syncModel])
  const handleRemoveNode = useCallback(
    (nodeId: string) => {
      const nextNodes = nodesRef.current.filter((node) => node.id !== nodeId).map(clearNodeTemperature)
      const nextEdges = edgesRef.current.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      )

      setNodes(nextNodes)
      setEdges(nextEdges)
      syncModel(nextNodes, nextEdges)
      setSimulationResult(null)
      setErrorMessage('')
      setNewEdgeConfig((prev) => deriveEdgeDefaults(nextNodes, prev))
    },
    [syncModel],
  )

  const handleNodeFieldChange = useCallback(
    <K extends keyof ThermalNodeData>(nodeId: string, key: K, value: ThermalNodeData[K]) => {
      setNodes((prev) => {
        const next = prev.map((node) => {
          if (node.id !== nodeId) {
            return node
          }

          const nextData: ThermalNodeData = {
            ...node.data,
            [key]: value,
          }

          if (key !== 'latestTemp') {
            nextData.latestTemp = undefined
          }

          return decorateNode({ ...node, data: nextData })
        })

        syncModel(next, edgesRef.current)
        return next
      })

      setSimulationResult(null)
      setErrorMessage('')
    },
    [syncModel],
  )

  const handleEdgeConductanceChange = useCallback(
    (edgeId: string, value: number) => {
      const nextEdges = edgesRef.current.map((edge) =>
        edge.id === edgeId ? { ...edge, data: { conductance: value } } : edge,
      )
      const nextNodes = nodesRef.current.map(clearNodeTemperature)

      setEdges(nextEdges)
      setNodes(nextNodes)
      syncModel(nextNodes, nextEdges)
      setSimulationResult(null)
      setErrorMessage('')
    },
    [syncModel],
  )

  const handleRemoveEdge = useCallback(
    (edgeId: string) => {
      const nextEdges = edgesRef.current.filter((edge) => edge.id !== edgeId)
      const nextNodes = nodesRef.current.map(clearNodeTemperature)

      setEdges(nextEdges)
      setNodes(nextNodes)
      syncModel(nextNodes, nextEdges)
      setSimulationResult(null)
      setErrorMessage('')
    },
    [syncModel],
  )

  const nodeEditorValue = useMemo<NodeEditorContextValue>(
    () => ({
      onFieldChange: handleNodeFieldChange,
      onRemove: handleRemoveNode,
    }),
    [handleNodeFieldChange, handleRemoveNode],
  )

  const edgeEditorValue = useMemo<EdgeEditorContextValue>(
    () => ({
      onConductanceChange: handleEdgeConductanceChange,
      onRemove: handleRemoveEdge,
    }),
    [handleEdgeConductanceChange, handleRemoveEdge],
  )

  const handleAddEdge = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const { sourceId, targetId, conductance } = newEdgeConfig

      if (!sourceId || !targetId || sourceId === targetId) {
        return
      }

      const duplicate = edgesRef.current.some(
        (edge) => edge.source === sourceId && edge.target === targetId,
      )

      if (duplicate) {
        return
      }

      const nextEdges = [...edgesRef.current, createEdge(sourceId, targetId, conductance)]
      const nextNodes = nodesRef.current.map(clearNodeTemperature)

      setEdges(nextEdges)
      setNodes(nextNodes)
      syncModel(nextNodes, nextEdges)
      setSimulationResult(null)
      setErrorMessage('')
      setNewEdgeConfig((prev) => ({ ...prev, conductance: 1 }))
    },
    [newEdgeConfig, syncModel],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return
      }

      const exists = edgesRef.current.some(
        (edge) => edge.source === connection.source && edge.target === connection.target,
      )

      if (exists) {
        return
      }

      const nextEdges = [
        ...edgesRef.current,
        createEdge(connection.source, connection.target, 1),
      ]
      const nextNodes = nodesRef.current.map(clearNodeTemperature)

      setEdges(nextEdges)
      setNodes(nextNodes)
      syncModel(nextNodes, nextEdges)
      setSimulationResult(null)
      setErrorMessage('')
      setNewEdgeConfig((prev) =>
        deriveEdgeDefaults(nextNodes, {
          ...prev,
          sourceId: connection.source!,
          targetId: connection.target!,
        }),
      )
    },
    [syncModel],
  )

  const handleSimulationSettingChange = useCallback(
    (key: keyof SimulationSettings, value: number) => {
      setSimulationSettings((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const runSimulation = useCallback(() => {
    const modelNodes = nodesRef.current.map((node) => ({
      id: node.id,
      name: node.data.name,
      initialTemp: node.data.initialTemp,
      heatCapacity: node.data.heatCapacity,
      isFixed: node.data.isFixed,
      fixedTemp: node.data.fixedTemp,
    }))

    const modelEdges = edgesRef.current.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      conductance: edge.data?.conductance ?? 0,
    }))

    try {
      const result = simulateThermalNetwork(modelNodes, modelEdges, simulationSettings)
      setSimulationResult(result)
      setErrorMessage('')

      const nextNodes = nodesRef.current.map((node) => {
        const series = result.series.find((entry) => entry.nodeId === node.id)

        if (!series) {
          return clearNodeTemperature(node)
        }

        const latest = series.temperatures[series.temperatures.length - 1]
        return decorateNode({
          ...node,
          data: { ...node.data, latestTemp: latest },
        })
      })

      setNodes(nextNodes)
      syncModel(nextNodes, edgesRef.current)
    } catch (error) {
      if (error instanceof SimulationError) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage(UI_TEXT.errorUnexpected)
      }

      setSimulationResult(null)
      const nextNodes = nodesRef.current.map(clearNodeTemperature)
      setNodes(nextNodes)
      syncModel(nextNodes, edgesRef.current)
    }
  }, [simulationSettings, syncModel])

  const exportModelToJson = useCallback(() => {
    const model = buildModelFromState(nodesRef.current, edgesRef.current)
    const blob = new Blob([JSON.stringify(model, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = 'thermal-model.json'
    anchor.click()

    URL.revokeObjectURL(url)
  }, [])

  const applyJsonModel = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonEditorValue) as ModelFile

      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error(UI_TEXT.jsonNeedsNodes)
      }

      const normalizedNodes: ModelNode[] = parsed.nodes.map((node, index) => {
        if (!node || typeof node !== 'object') {
          throw new Error(withIndex(UI_TEXT.nodeInvalid, index))
        }

        const candidate = node as Partial<ModelNode>

        if (typeof candidate.id !== 'string') {
          throw new Error(withIndex(UI_TEXT.nodeIdInvalid, index))
        }

        if (typeof candidate.name !== 'string') {
          throw new Error(withIndex(UI_TEXT.nodeNameInvalid, index))
        }

        if (!candidate.position || typeof candidate.position !== 'object') {
          throw new Error(withIndex(UI_TEXT.nodePositionInvalid, index))
        }

        const { x, y } = candidate.position as { x?: number; y?: number }

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new Error(withIndex(UI_TEXT.nodePositionNeedsNumbers, index))
        }

        return {
          id: candidate.id,
          name: candidate.name,
          initialTemp: Number(candidate.initialTemp ?? 0),
          heatCapacity: Number(candidate.heatCapacity ?? 1),
          isFixed: Boolean(candidate.isFixed),
          fixedTemp: Number(candidate.fixedTemp ?? 0),
          position: { x: Number(x), y: Number(y) },
        }
      })

      const normalizedEdges: ModelEdge[] = parsed.edges.map((edge, index) => {
        if (!edge || typeof edge !== 'object') {
          throw new Error(withIndex(UI_TEXT.edgeInvalid, index))
        }

        const candidate = edge as Partial<ModelEdge>

        if (typeof candidate.id !== 'string') {
          throw new Error(withIndex(UI_TEXT.edgeIdInvalid, index))
        }

        if (typeof candidate.source !== 'string' || typeof candidate.target !== 'string') {
          throw new Error(withIndex(UI_TEXT.edgeEndpointsInvalid, index))
        }

        return {
          id: candidate.id,
          source: candidate.source,
          target: candidate.target,
          conductance: Number(candidate.conductance ?? 0),
        }
      })

      const nextNodes = buildNodesFromModel(normalizedNodes)
      const nextEdges = buildEdgesFromModel(normalizedEdges)

      setNodes(nextNodes)
      setEdges(nextEdges)
      syncModel(nextNodes, nextEdges)
      setSimulationResult(null)
      setErrorMessage('')
      setJsonEditorError('')
      nodeIdCounter.current = computeNextNodeCounter(nextNodes)
      setNewEdgeConfig((prev) => deriveEdgeDefaults(nextNodes, prev))
    } catch (error) {
      setJsonEditorError(
        error instanceof Error ? error.message : UI_TEXT.jsonParseFailed,
      )
    }
  }, [jsonEditorValue, syncModel])

  const resetToInitialModel = useCallback(() => {
    const defaultNodes = buildNodesFromModel(initialModel.nodes)
    const defaultEdges = buildEdgesFromModel(initialModel.edges)

    setNodes(defaultNodes)
    setEdges(defaultEdges)
    syncModel(defaultNodes, defaultEdges)
    setSimulationResult(null)
    setErrorMessage('')
    setJsonEditorError('')
    nodeIdCounter.current = computeNextNodeCounter(defaultNodes)
    setNewEdgeConfig(deriveEdgeDefaults(defaultNodes))
  }, [syncModel])
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{UI_TEXT.headerTitle}</h1>
        <p>{UI_TEXT.headerSubtitle}</p>
      </header>
      <div className="app-main">
        <aside className="control-panel">
          <section className="panel-section">
            <div className="panel-section__header">
              <h2>{UI_TEXT.nodeManagement}</h2>
              <button className="primary" type="button" onClick={handleAddNode}>
                {UI_TEXT.addNode}
              </button>
            </div>
            <div className="panel-section__body node-list">
              {nodes.length === 0 ? (
                <p className="empty-placeholder">{UI_TEXT.addNodePlaceholder}</p>
              ) : (
                nodes.map((node) => {
                  const data = node.data

                  return (
                    <div className="node-card" key={node.id}>
                      <div className="node-card__header">
                        <h3>{data.name}</h3>
                        <button
                          className="ghost"
                          type="button"
                          onClick={() => handleRemoveNode(node.id)}
                        >
                          {UI_TEXT.delete}
                        </button>
                      </div>
                      <div className="form-grid">
                        <label>
                          {UI_TEXT.fieldName}
                          <input
                            type="text"
                            value={data.name}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              handleNodeFieldChange(node.id, 'name', event.target.value)
                            }
                          />
                        </label>
                        <label>
                          {UI_TEXT.fieldInitialTemp}
                          <input
                            type="number"
                            step="0.1"
                            value={data.initialTemp}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              handleNodeFieldChange(
                                node.id,
                                'initialTemp',
                                Number(event.target.value),
                              )
                            }
                            disabled={data.isFixed}
                          />
                        </label>
                        <label>
                          {UI_TEXT.fieldHeatCapacity}
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={data.heatCapacity}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              handleNodeFieldChange(
                                node.id,
                                'heatCapacity',
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={data.isFixed}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              handleNodeFieldChange(node.id, 'isFixed', event.target.checked)
                            }
                          />
                          {UI_TEXT.fieldLockTemperature}
                        </label>
                        <label>
                          {UI_TEXT.fieldFixedTemp}
                          <input
                            type="number"
                            step="0.1"
                            value={data.fixedTemp}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              handleNodeFieldChange(
                                node.id,
                                'fixedTemp',
                                Number(event.target.value),
                              )
                            }
                            disabled={!data.isFixed}
                          />
                        </label>
                        {data.latestTemp !== undefined && (
                          <p className="node-card__result">
                            {UI_TEXT.latestTemp}: {formatNumber(data.latestTemp)} {UI_TEXT.degree}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <section className="panel-section">
            <h2>{UI_TEXT.connectionManagement}</h2>
            <form className="edge-form" onSubmit={handleAddEdge}>
              <label>
                {UI_TEXT.nodeA}
                <select
                  value={newEdgeConfig.sourceId}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setNewEdgeConfig((prev) => ({
                      ...prev,
                      sourceId: event.target.value,
                    }))
                  }
                >
                  {nodeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {UI_TEXT.nodeB}
                <select
                  value={newEdgeConfig.targetId}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setNewEdgeConfig((prev) => ({
                      ...prev,
                      targetId: event.target.value,
                    }))
                  }
                >
                  {nodeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {UI_TEXT.conductance}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={newEdgeConfig.conductance}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setNewEdgeConfig((prev) => ({
                      ...prev,
                      conductance: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <button className="primary" type="submit" disabled={disableEdgeCreation}>
                {UI_TEXT.addConnection}
              </button>
            </form>

            <div className="panel-section__body">
              {edges.length === 0 ? (
                <p className="empty-placeholder">{UI_TEXT.noConnections}</p>
              ) : (
                <ul className="edge-list">
                  {edges.map((edge) => (
                    <li key={edge.id} className="edge-list__item">
                      <div>
                        {nodeNameMap.get(edge.source) ?? edge.source} {UI_TEXT.arrow}{' '}
                        {nodeNameMap.get(edge.target) ?? edge.target}
                      </div>
                      <div className="edge-list__controls">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={edge.data?.conductance ?? 0}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            handleEdgeConductanceChange(edge.id, Number(event.target.value))
                          }
                        />
                        <span className="edge-list__unit">W/K</span>
                        <button
                          className="ghost"
                          type="button"
                          onClick={() => handleRemoveEdge(edge.id)}
                        >
                          {UI_TEXT.delete}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="panel-section">
            <h2>{UI_TEXT.simulationSettings}</h2>
            <div className="form-grid">
              <label>
                {UI_TEXT.timeStep}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={simulationSettings.timeStep}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    handleSimulationSettingChange('timeStep', Number(event.target.value))
                  }
                />
              </label>
              <label>
                {UI_TEXT.totalTime}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={simulationSettings.totalTime}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    handleSimulationSettingChange('totalTime', Number(event.target.value))
                  }
                />
              </label>
            </div>
            <button className="primary" type="button" onClick={runSimulation}>
              {UI_TEXT.runSimulation}
            </button>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
          </section>

          <section className="panel-section json-editor">
            <h2>{UI_TEXT.jsonEditor}</h2>
            <textarea
              className="json-editor__textarea"
              value={jsonEditorValue}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setJsonEditorValue(event.target.value)
              }
              spellCheck={false}
            />
            {jsonEditorError && <p className="json-editor__error">{jsonEditorError}</p>}
            <div className="json-editor__buttons">
              <button className="primary" type="button" onClick={exportModelToJson}>
                {UI_TEXT.export}
              </button>
              <button className="ghost" type="button" onClick={applyJsonModel}>
                {UI_TEXT.import}
              </button>
              <button className="ghost" type="button" onClick={resetToInitialModel}>
                {UI_TEXT.resetPreset}
              </button>
            </div>
          </section>
        </aside>

        <main className="workspace">
          <section className="flow-wrapper">
            <NodeEditorContext.Provider value={nodeEditorValue}>
              <EdgeEditorContext.Provider value={edgeEditorValue}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onConnect={handleConnect}
                  fitView
                  proOptions={{ hideAttribution: true }}
                  deleteKeyCode={null}
                >
                  <Background gap={16} color="#e5e7eb" />
                  <Controls position="bottom-right" showInteractive={false} />
                </ReactFlow>
              </EdgeEditorContext.Provider>
            </NodeEditorContext.Provider>
          </section>

          <section className="plot-wrapper">
            {simulationResult ? (
              <Plot
                data={simulationResult.series.map((series) => ({
                  x: simulationResult.times,
                  y: series.temperatures,
                  type: 'scatter',
                  mode: 'lines+markers',
                  name: series.name,
                }))}
                layout={{
                  title: { text: UI_TEXT.graphTitle },
                  xaxis: { title: { text: UI_TEXT.axisTime } },
                  yaxis: { title: { text: UI_TEXT.axisTemp } },
                  legend: { orientation: 'h', y: -0.2 },
                  margin: { l: 60, r: 20, t: 40, b: 60 },
                  hovermode: 'closest',
                }}
                config={{ responsive: true, displaylogo: false }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <div className="plot-placeholder">
                <p>{UI_TEXT.placeholder}</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
const App = () => (
  <ReactFlowProvider>
    <ThermalApp />
  </ReactFlowProvider>
)

export default App





