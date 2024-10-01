# SQSBench

## Packages

### Producer

A Lambda function that generates messages according to the prevailing message rate per minute.

The producer:
- Must be invoked once by an EventBridge scheduler rule every minute
- Must use the prevailing message rate per minute to determine the number of messages to produce
- Must calculate a delay for each message based on the specified distribution algorithm
- Must sort the messages according to ascending delay
- Must invoke the emitter in fire and forget mode
- Must invoke all emitters with the same set of messages
- Must invoke an emitter for each queue specified
- Must create multiple emitter invocations to avoid exceeding 500 messages per invocation
- Must limit emitter invocations to 50 concurrent requests

### Emitter

A Lambda function that sends messages to a queue.  The messages are sent in batches of 10.  The emitter is invoked
by the producer.

The emitter:
- Must not send more than 10 messages per request to the queue.
- Must not make more than 50 concurrent requests to the queue.

### Poller

- Must be created for each queue specified as a poller based queue
- Must use the specified batch size, receive time and concurrency
- Must be invoked once per minute by an EventBridge scheduler rule
- Must poll the queue for messages using the specified batch size and receive time
- Must invoke the consumer with the messages received

### Consumer

- Must pause for the specified message duration for each message received
- Must return batch item failures if any

### Pipe

- Must be created for each queue specified as a pipe based queue
- Must use the specified batch size and batching window

### Event Source Mapping

- Must be created for each queue specified as an Event Source Map based queue
- Must use the specified batch size, batching window and concurrency