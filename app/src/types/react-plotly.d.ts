declare module 'react-plotly.js' {
  import type { CSSProperties, FC } from 'react'
  import type { Config, Data, Layout } from 'plotly.js'

  export interface PlotParams {
    data: Partial<Data>[]
    layout?: Partial<Layout>
    config?: Partial<Config>
    style?: CSSProperties
    className?: string
    useResizeHandler?: boolean
    divId?: string
  }

  const Plot: FC<PlotParams>
  export default Plot
}
