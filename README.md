# SQSBench

## Motivation

To better understand the trade-offs between different polling mechanisms for Amazon Simple Queue Service (SQS)
by comparing the resource utilisation and cost of each method.

## Implementation

This is a CDK application that can be deployed to your own Amazon Web Services (AWS) account to allow you to 
evaluate the resource utilisation/cost of using Amazon Simple Queue Service (SQS) in a serverless environment.

It will run automated tests to simulate messages and associated processing.

IMPORTANT: This application will incur charges on your account whilst tests are enabled.  You can leave
the application deployed in order to continue looking at historical results, but you should disable
the tests when you are not actively measuring.

SQS Supports multiple ways to consume messages from a queue, including:

- EventBridge Pipes
- Lambda Event Source/Event Source Mapping
- Manual Polling via Lambda

NB: This application uses SQS Standard Queues only

It's important to understand that SQS charges are levied based on the number of API requests made, rather
than the number of messages sent/received.  EventBridge Pipes are optimised towards high message rates and 
low latency delivery, and will upscale aggressively to meet demand, but downscale more conservatively.
If you have modest message rates, or are not concerned about latency, you may find that other polling mechanisms
are more cost effective.  This application is designed to help you find out the sweet spot.

![Sample Widget](./docs/assets/SampleWidget.png "Sample Widget")

## Usage

1. Clone the repository
2. `npm install` to install the dependencies
3. Edit `packages/app/index.ts` to configure and enable the tests you want to run (tests run in parallel to aid 
   comparison)
4. `cdk deploy` to deploy the stack (assumes you have the CLI installed and configured for your AWS account)
5. Go to the AWS Console > CloudWatch > Dashboards and select the `SQSBenchDashboard-XXXX` to monitor the tests

## A Word about Test Resource Names

The resources created by the tests are named according to the test parameters.  This is to allow you to easily
identify the resources created by each test.  The names are hashed to ensure they are unique.  They are also used 
to associated test metrics for the dashboard, so if you change the parameters of the tests, you will also
change the resource names and lose association with historical results.

If you want to refine the test parameters for a further test, it would be better to duplicate the original test 
definition, disable the original version and change the parameters on the copy.  Only remove tests from the array 
if you are sure you no longer need access to the historical metrics/logs etc, and removing the test will destroy 
the resources.

NB: You can't have two tests with the same parameters, as this will prevent resource creation.

## Methodology

Each test creates a queue, consumer lambda to act as the target for the messages, and any additional resources
necessary to direct the messages to the consumer (e.g. Pipe, Event Source Mapping or Lambda Poller), and a single 
producer lambda to generate the messages for all tests.

Test resources are named according to the test parameters, e.g a Pipe test with batch size 10, and batch window 10
will be named `SQSBenchTest-Pipe-B10-W10-[hash]` (where hash is 8 hex digits).

The producer lambda is invoked once per minute by an EventBridge scheduler rule.  The producer lambda checks for
the parameter store for the current state of the test, and generates an batch of messages based on the prevailing
message rate and randomised across the next minute according to the weighted distribution algorithm. The same 
batch of messages are then sent to each of the test queues, so that the polling performance can be compared.

## Concurrency Limitations

AWS Accounts have a limit of 1000 concurrent Lambda invocations.  This limit is shared across all functions in the 
account, and a large number of parallel tests could consume a good chunk of your lambda capacity, especially
when the message rate is into the thousands per minute.

When the producer runs, for each batch of messages to be sent to a queue, it split the batch into smaller batches of
up to 500 messages, and then invokes the emitter lambda with each of these smaller batches.  So for example,
each time the producer runs (once per minute) and it has messages to send, it will create at least one concurrent
lambda for each test (more if the message rate is >500), and at the same time, multiple invocations of the consumer
could be made by each test depending on the polling method, batch size and concurrency settings of the test.

## Configuration

Let's consider the following configuration options:

```typescript
new SqsBench(app, 'SqsBench', {
  minRate: 1,
  maxRate: 4096,
  consumerPerMessageDuration: Duration.millis(50),
  dutyCycle: 0.75,
  rateDurationInMinutes: 60,
  rateScaleFactor: 2,
  weightDistribution: [1, 2, 1],
  consumerMemory: 128,
  tests: [ /* ... */],
})
```

### minRate

The minimum message rate per minute to test.  After first deploy, the producer will start at a rate of 0 until the
top of the hour.  It will then start testing at the minRate

### maxRate

The maximum message rate per minute to test.  The producer will increase the message rate by the rateScaleFactor
every rateDurationInMinutes until it reaches the maxRate

### consumerPerMessageDuration

The duration in milliseconds that the consumer pauses for each message received.  This allows you to simulate message
processing time and allows for an estimation of overall costs.  Message rate and batch size will have a bearing on
the overhead of processing messages.

### dutyCycle

The proportion of the rateDurationInMinutes that the producer will be actively sending messages.  The producer will
be inactive for the remaining time.  This allows the various polling methods to scale back the overhead of dealing
with messages from the previous testing period.  For example, if there has been a sustained message rate of 1000+
messages per minute, an EventBridge Pipe takes a number of minutes for the poller fleet to scale back to its 
background level.  When message flow restarts, it takes another period of time for the poller fleet to scale up to
deal with the new message rate.  By allowing a period of inactivity you can ensure that the next message rate to be
tested reflects the real world significance of fluctuating message rates.

If you anticipate a sustained message rate, you can set the dutyCycle to 1, so that the producer is always active.

### rateDurationInMinutes

The duration in minutes that the producer will spend at each message rate.  In practice this should normally be 
equivalent to 1 or more hours, as it makes interpretation of the dashboard statistics easier.

### rateScaleFactor

The factor by which the message rate will be increased every rateDurationInMinutes.  This is a multiplier of the 
prevailing rate, so a factor of two would lead to a doubling of the message rate every rateDurationInMinutes. e.g.
1, 2, 4, 8, 16, ...

### weightDistribution

The distribution of messages across the minute.  The producer generates messages randomly across the minute, and the
weight distribution allows you to bias within the minute.

- [1] - All messages randomised across the minute
- [2, 1] - 66% of messages across the first half of the minute, 33% across the second half
- [1, 2, 1] - 25% of messages at the start, 50% in the middle, 25% at the end

This allows you to create some clustering of messages to simulate real world scenarios where messages are not evenly
distributed across the minute.  With low message rates, randomisation could easily lead to biases towards the start
or end of the minute, whereas for high message rates, the distribution will be more even.  By configuring the weight
distribution you can apply some bias to the message generation.

### consumerMemory

The memory setting for the consumer lambda.  This will have a bearing on the cost of the consumer.

### tests

One or more tests that you want to run.  Individual tests can be defined and disabled.  Note that if you remove a test
from the array, its corresponding resources will be removed and the test will no longer be visible in the dashboard.

Cloudwatch Metrics store metrics, typically for 15 days at least, so by leaving the test defined by disabled,
you can still review historical metrics.

Even within test different poller types, there is latitude for fine tuning the poller configuration, so you
may well want to run more than one test for each poller type so you can see the effects.

NB: The producer is only enabled if there is at least one test enabled.

IMPORTANT: 1 minute / consumerPerMessageDuration * maxConcurrency is the theoretical maximum message rate that a
poller can handle.  If you exceed this rate, you will start to see backlogs and increased latency.  However, there is 
overhead in the polling process which will reduce the effective message rate that can be handled.  The Lambda pollers
are designed to be more efficient at lower message rates, but will start to struggle as the message rate increases.
The most practical way to increase capacity is to increase concurrency.

```typescript
tests: [
  { 
    enabled: true,
    batchSize: 10,
    batchWindow: Duration.seconds(0), 
    pollerType: PollerType.Lambda, 
    maxSessionDuration: Duration.seconds(60), 
    maxConcurrency: 2,
    invocationType: InvocationType.REQUEST_RESPONSE,
  },
//...
]
```
#### enabled

Whether the test is enabled or not.  If you want to disable a test, set this to false.

#### pollerType

The type of poller to use.  The options are:

- Lambda - A Lambda function that polls the queue for messages.  A simplistic implementation is provided that uses
  a single polling loop but with one or more concurrent consumers up to the maxConcurrency setting.  
  If throttled, the poller will not be requesting messages and a backlog can start to form.  The poller continues
  to poll until an empty receive, up to the maxSessionDuration.
- Pipe - An EventBridge Pipe that sends messages to the consumer
- EventSource - An Event Source Mapping that sends messages to a Lambda function

#### batchSize

The maximum number of messages to send to the consumer in each invocation.  This is a maximum, and there is no guarantee
that the batch is filled, depending on the poller type.

#### batchWindow

The maximum time to wait for the batch to be filled.  If the batch is not filled within this time, the consumer will
be invoked with the messages that have been received.

For all poller type, the batch window defines the maximum latency of message delivery.  If the batch size
is satisfied first, then the consumer will be invoked earlier.  Note that for Pipe and ESM pollers, there are multiple
pollers active at any time, and their batch windows aren't synchronised, so you may receive messages from different
pollers at different times, depending on how the batching parameters are satisfied.  The Lambda poller only has a
single poller, so the batch window is more deterministic.

For Lambda pollers, the polling may be terminated if insufficient messages are received, which prevents the poller
from continuing to poll for messages when there is a low message rate.  As the batch window adds to the latency of
message delivery, you will want to choose a value that minimises consumer invocations whilst not exceeding your
intended latency.

#### maxSessionDuration

For Lambda pollers, the maximum time that the poller runs for.  The poller is started every minute and reads as
many messages as possible in the maxSessionDuration time.  The poller may end the session early if there is an
empty receive or the per second message rate drops below 10% of the peak rate within the same session.  This
prevents the poller from consuming excessive Lambda compute or being kept alive by a trickle of messages which could 
be more effectively collected on a subsequent poll (valid given that Lambda pollers are attempting to optimise
resource usage whilst deprioritizing latency, unlike the AWS managed pollers).

#### maxConcurrency

For Lambda and Event Source pollers, the maximum number of consumers that can be invoked concurrently.  The consumer
will runtime is determined by the consumerPerMessageDuration setting.

For Event Source pollers, it can be omitted for no limit (other than account limitations)

#### highResMetrics

Whether to enable high resolution metrics, which gives visibility of how messages are distributed within the minute.
You only need to enabled one test with highResMetrics for this to work.  If it is disabled, it shows the standard
resolution metrics, but this isn't much use as its not sufficiently granular to show the distribution of messages
within the minute.  

Enabling this is really only useful when designing the weight distribution.  

IMPORTANT: can lead to high Cloudwatch charges if left enabled for long periods.

#### invocationType

For Lambda pollers, the consumer can be invoked with using Request/Response or Event (async) invocation types. 
Depending on the configuration and consumer perMessageDuration, there may be a difference in the approach.

This affects how the consumer is invoked by the poller.  With Request/Response (-RR suffix on the test name),
the poller invokes the consumer and waits for the response, then processes message deletions from the queue
(accounting for any batch item failures reported by the consumer).  The maxConcurrency limits the number of 
concurrent consumers and thus slows down polling of messages from the queue.

The Event invocation type (-EV suffix on the test name) is a fire and forget invocation (async).  The poller 
invokes the consumer but attaches a lambda destination to the outcome, which handles the message deletions from the
queue.  This allows the poller to continue polling messages from the queue without waiting for the consumer to
complete and should increase throughput.  Consumer concurrency is limited by setting Reserved Concurrency on the
consumer lambda (which limits the concurrency but also reserves concurrency across your AWS account).

## Dashboard

The dashboard shows the following metrics:

### Total Cost Per Period

The sum of the cost for each test for the selected period (default, 1 minute).  The numbers can be tiny, but this
gives a good view over the period of each test and allows for comparison.  There is a good degree of fluctuation due
to AWS overheads/latencies, and you can smooth some of this out by switching the dashboard period to 5 minutes or more,
which will make it easier to compare the different tests.

### Total Cost Per Month

The sum of the cost for each test prorated to a monthly cost.  This can be more understandable than the cost per period
as its likely how you view your AWS costs based on invoices.  The costs are derived from each hour, so the widget will
be behind by up to an hour in the values it shows.

### Cost of Consumer

The cost of the consumer for the selected period.

### Cost Per Message

The cost per message for the selected period.

### Approximate Number of Messages Visible

The number of messages visible in the queue during the period (messages waiting to be polled)

### Approximate Age of Oldest Messages

The age of the oldest message in the queue during the period.

### Delivery Latency

The time taken for the message to be delivered to the consumer.  This is the time between when the message was 
scheduled to be visible in the queue and the time the consumer was invoked.  The queues own 'Average Age of Oldest
Message' also includes the pre-visibility scheduling by the producer which distorts the true delivery latency.

### Messages Received

The number of messages received by the queue during the period.

### Empty Receives

The number of empty receives by the queue during the period.

### Average Messages Received at Consumer

The average number of messages received by the consumer during the period.

### Weighted Message Rate

The weighted message rate for the period.  When highResMetrics is enabled, this allows you to see the way in which 
messages are being distributed across the minute.

## Observations

Pipes tend to work out more expensive BUT have the advantage of being fully scalable.  By design they incur a high
number of empty receives due to potentially redundant pollers, but this is a trade-off for the low latency delivery.
The cost overhead tends to build over time to as it adjusts to consistent message rates, and may cope better than
other solutions to fluctating/bursty message rates.  When traffic does go away, it takes a fair while for the 
redundant pollers to age out.

Event Source Mapping works similarly to Pipes but without the ultimate in scaling, and has the advantage that you can
constrain the concurrency to reduce the overhead at lower message rates.  The downside is that hobbles the scaling
ability and therefore bursts/increases in traffic can lead to backlogs, thus increasing latency.  An Event Source
with minimum concurrency can work out to be the most cost effective choice for very low message rates, but there
isn't much in it compared to a Lambda poller, although ESM retains the benefit of low latency delivery.

The Lambda poller is somewhat simplistic, and trades latency for cost.  You need to be comfortable with >1 minute
latency on message processing.  The cost is more predictable and scales well through lower message rates, but is
ultimately capped by the ability to deal with both polling and consumer invocations once message rates exceed
its capability.

