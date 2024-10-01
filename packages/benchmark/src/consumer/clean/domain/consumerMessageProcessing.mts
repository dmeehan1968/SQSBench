import { UseCase } from "./useCase.mjs"
import { Record } from "../../record.mjs"

export interface ConsumerMessageProcessing extends UseCase<(Record | Error)[], PromiseSettledResult<any>[]> {
}