/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "recharts" {
  export const ResponsiveContainer: any
  export const Tooltip: any
  export const Legend: any
  export const BarChart: any
  export const Bar: any
  export const LineChart: any
  export const Line: any
  export const AreaChart: any
  export const Area: any
  export const PieChart: any
  export const Pie: any
  export const Cell: any
  export const XAxis: any
  export const YAxis: any
  export const CartesianGrid: any
  export const ReferenceLine: any
  export type TooltipProps = any
  export type TooltipValueType = any
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export type DefaultTooltipContentProps<T = any, N = any> = any
  export type DefaultLegendContentProps = any
}

declare module "react-icons/si" {
  import type { ComponentType } from "react"
  const icons: Record<string, ComponentType<any>>
  export default icons
  export const SiDocker: ComponentType<any>
  export const SiTypescript: ComponentType<any>
  export const SiJavascript: ComponentType<any>
  export const SiPython: ComponentType<any>
  export const SiReact: ComponentType<any>
  export const SiNodedotjs: ComponentType<any>
  export const SiGo: ComponentType<any>
  export const SiRust: ComponentType<any>
  export const SiRuby: ComponentType<any>
  export const SiPhp: ComponentType<any>
  export const SiHtml5: ComponentType<any>
  export const SiCss3: ComponentType<any>
  export const SiGraphql: ComponentType<any>
  export const SiPostgresql: ComponentType<any>
  export const SiMongodb: ComponentType<any>
  export const SiRedis: ComponentType<any>
  export const SiNginx: ComponentType<any>
  export const SiGithub: ComponentType<any>
  export const SiGitlab: ComponentType<any>
  export const SiBitbucket: ComponentType<any>
  export const SiJenkins: ComponentType<any>
  export const SiKubernetes: ComponentType<any>
  export const SiAmazoneks: ComponentType<any>
  export const SiAmazons3: ComponentType<any>
  export const SiAmazondynamodb: ComponentType<any>
  export const SiGooglecloud: ComponentType<any>
  export const SiMicrosoftazure: ComponentType<any>
  export const SiVercel: ComponentType<any>
  export const SiNetlify: ComponentType<any>
  export const SiCloudflare: ComponentType<any>
  export const SiLaravel: ComponentType<any>
  export const SiDjango: ComponentType<any>
  export const SiFlask: ComponentType<any>
  export const SiFastapi: ComponentType<any>
  export const SiExpress: ComponentType<any>
  export const SiWordpress: ComponentType<any>
  export const SiGhost: ComponentType<any>
  export const SiStrapi: ComponentType<any>
  export const SiPayloadcms: ComponentType<any>
  export const SiN8n: ComponentType<any>
  export const SiN8N: ComponentType<any>
  export const SiDirectus: ComponentType<any>
  export const SiPocketbase: ComponentType<any>
  export const SiUmami: ComponentType<any>
  export const SiPlausibleanalytics: ComponentType<any>
}

declare module "sshpk" {
  export class PrivateKey {
    static parse(data: string | Buffer, format?: string): PrivateKey
    toPublic(): Key
    toString(format?: string, options?: { passphrase?: string }): string
    toBuffer(format?: string): Buffer
    fingerprint(algo?: string): Fingerprint
    type: string
    size: number
    comment: string
  }

  export class Key {
    fingerprint(algo?: string): Fingerprint
    toString(format?: string): string
    toBuffer(format?: string): Buffer
    type: string
    size: number
    comment: string
  }

  export class Fingerprint {
    hash: string
    algo: string
    toString(): string
  }

  export function parsePrivateKey(
    data: string | Buffer,
    format?: string
  ): PrivateKey
  export function generatePrivateKey(
    algo: string,
    options?: { bits?: number }
  ): PrivateKey
  export function parseKey(data: string | Buffer, type?: string): Key
  export function parseSignature(data: string | Buffer, algo?: string): any
  export class Identity {
    toString(): string
    toBuffer(): Buffer
  }
  export class Certificate {
    toString(): string
    toBuffer(): Buffer
  }
}

declare module "@prisma/adapter-pg" {
  export class PrismaPg {
    connect(): Promise<any>
    provider: any
    adapterName: string
    constructor(options: { connectionString: string })
  }
}
