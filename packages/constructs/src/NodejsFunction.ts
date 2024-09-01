import {
  NodejsFunction as NodejsFunctionBase,
  NodejsFunctionProps as NodejsFunctionBaseProps,
} from "aws-cdk-lib/aws-lambda-nodejs"
import { Fqn, FqnOptions } from "./Fqn"
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs"
import { RemovalPolicy, Stage } from "aws-cdk-lib"
import { deepmerge } from "deepmerge-ts"
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam"
import { XRayTraceConfiguration } from "@sqsbench/helpers"

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  SILENT = 'SILENT',
}

export interface NodejsFunctionProps extends Omit<NodejsFunctionBaseProps, 'functionName' | 'entry' | 'tracing' | 'logGroup'> {
  entry: Required<NodejsFunctionBaseProps['entry']>,
  grant?: (grantee: any) => void
  tracing?: XRayTraceConfiguration
  logging?: {
    level?: LogLevel
    logGroup?: LogGroup
    sampleRate?: number
  },
  functionNameOptions?: FqnOptions,
}

export class NodejsFunction extends NodejsFunctionBase {

  private readonly functionProps: NodejsFunctionBaseProps

  constructor(scope: Construct, id: string, { grant, logging, logRetention, tracing, bundling: { externalModules, ...bundling } = {}, functionNameOptions, ...props }: NodejsFunctionProps) {

    const functionName = Fqn(scope, deepmerge({ suffix: id, maxLength: 64 }, functionNameOptions))

    const logGroup = logging?.logGroup ?? new LogGroup(scope, id + 'Log', {
      logGroupName: '/aws/lambda/' + functionName,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logRetention ?? RetentionDays.ONE_WEEK,
    })

    const isProd = Stage.of(scope)?.stageName === 'Prod'
    const sourceMap = isProd ? false : bundling?.sourceMap ?? true
    const awsSdkV3Runtimes = [ undefined, Runtime.NODEJS_18_X, Runtime.NODEJS_20_X, Runtime.NODEJS_LATEST ]
    const awsSdk = awsSdkV3Runtimes.includes(props.runtime)
      ? '@aws-sdk' // v3
      : 'aws-sdk'  // v2

    const computedExternalModules = new Set([
      ...(externalModules ?? [ awsSdk ]),
      // layers can contain externalModules property that defines what we should exclude from bundling
      ...props.layers?.map(layer => ((layer as any).externalModules ? (layer as any).externalModules : [])).flat() ?? [],
    ])

    const nodeOptions = (props.environment?.NODE_OPTIONS ?? '').split(' ')

    if (sourceMap) {
      nodeOptions.push('--enable-source-maps')
    }

    const defaultProps: NodejsFunctionBaseProps = {
      functionName,
      logGroup,
      runtime: Runtime.NODEJS_20_X,
      tracing: tracing?.enabled ?? false
        ? tracing?.passThrough ?? false ? Tracing.PASS_THROUGH : Tracing.ACTIVE
        : Tracing.DISABLED,
    }

    const tracerProps: NodejsFunctionBaseProps = {
      environment: {
        POWERTOOLS_SERVICE_NAME: tracing?.serviceName ?? functionName,
        POWERTOOLS_TRACE_ENABLED: (tracing?.enabled || tracing?.passThrough) ? 'true' : 'false',
        POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: tracing?.captureHttpsRequests ?? true ? 'true' : 'false',
        POWERTOOLS_TRACER_CAPTURE_RESPONSE: tracing?.captureResponse ?? true ? 'true' : 'false',
        POWERTOOLS_TRACER_CAPTURE_ERROR: tracing?.captureError ?? true ? 'true' : 'false',
        POWERTOOLS_METRICS_NAMESPACE: process.env.npm_package_name ?? 'default_namespace',
        POWERTOOLS_LOG_LEVEL: logging?.level ?? LogLevel.ERROR,
        POWERTOOLS_LOGGER_SAMPLE_RATE: (logging?.sampleRate ?? 0).toString(),
      },
    }

    const nodeOptionsProps: NodejsFunctionBaseProps = {
      environment: {
        ...(nodeOptions.length > 0 ? { NODE_OPTIONS: nodeOptions.join(' ') } : {}),
      },
    }

    const bundlingProps: NodejsFunctionBaseProps = {
      bundling: deepmerge(bundling, {
        sourceMap,
        minify: isProd,
        externalModules: [...computedExternalModules],
      } satisfies NodejsFunctionBaseProps['bundling']),
    }

    // @ts-ignore deepmerge complex type error
    const fnProps: NodejsFunctionBaseProps = deepmerge(defaultProps, tracerProps, nodeOptionsProps, bundlingProps, props)

    super(scope, id, fnProps)
    this.functionProps = fnProps

    logGroup.grantWrite(this)

    // add XRay trace permissions even if tracing is disabled, so that they can be enabled via the AWS Console/CLI
    this.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
      resources: ['*'],
    }))

    grant?.(this)
  }

  get memorySize() {
    return this.functionProps.memorySize ?? 128
  }

  get metricsNamespace() {
    return this.functionProps.environment?.POWERTOOLS_METRICS_NAMESPACE ?? 'default_namespace'
  }
}