/**
 * Configuration for AWS Cloudwatch XRay Trace
 *
 * Trace environment variables and permissions are added by default even if tracing is disabled,
 * which allows it to be enabled via the AWS console or CLI without redeploying the function.  To enable/disable
 * you will need to:
 *
 * 1. Lambda > Function > Configuration > Monitoring and operation tools > XRay active tracing
 * 2. Lambda > Function > Configuration > Environment variables > POWERTOOLS_TRACING_ENABLED = true/false
 *
 * If you also want to trace downstream services, the downstream service needs to be configured with
 * pass through tracing enabled (which can be enabled in the config, console or CLI).
 *
 * @default No tracing
 * @see https://docs.aws.amazon.com/lambda/latest/dg/services-xray.html
 */

export interface XRayTraceConfiguration {
  /**
   * Enable tracing for the function.  When enabled, the type of tracing is determined by the passThrough option
   * (e.g. pass through only, or active)
   * @default false
   * @see {@link NodejsFunctionProps.tracing}
   */
  enabled?: boolean
  /**
   * If enabled, only trace if the upstream service tracing header contained sampled=1
   * @default false
   */
  passThrough?: boolean
  /**
   * The name of the service for tracing, defaults to the function name
   * @default The function name
   */
  serviceName?: string
  /**
   * Whether to capture HTTP requests
   * @default true
   */
  captureHttpsRequests?: boolean
  /**
   * Whether to capture response
   * @default true
   */
  captureResponse?: boolean
  /**
   * Whether to capture errors
   * @default true
   */
  captureError?: boolean
}