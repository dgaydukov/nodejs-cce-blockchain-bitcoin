/**
 * For every transaction that has confirmationNumber less than required(6 by default) we push bitcoin node to check if confirmationNumber
 * changed
 * Here we also update blockNumber for tx that was created by out bitcoin node
 */
require('module-alias/register')
const debug = require("debug")("txheck")
import {KafkaConnector} from "@kafka/kafkaConnector"
import {Transaction} from "@db/models/transaction"
import {BitcoinNode} from "@blockchain/bitcoinNode"
import {buildMessage} from "@deamons/helpers"

const METHOD_NEW_CONFIRMATION = "newConfirmation"
const METHOD_TX_WENT_INTO_BLOCK = "txWentIntoBlock"
const MAX_CONFIRMATION_NUMBER = process.env.MAX_CONFIRMATION_NUMBER



const run = () => {
    const intervalTime = Number(process.env.RUN_INTERVAL) * 1000
    const node = new BitcoinNode()
    const kc = new KafkaConnector()
    let allowRun = true
    const inner = ()=>{
        if(allowRun) {
            debug("start")
            allowRun = false
            check(node, kc)
                .then(() => {
                    allowRun = true
                    debug(`-------------finish-------------`)
                })
                .catch((ex) => {
                    allowRun = true
                    debug(`Error: ${ex}`)
                })
        }
    }
    inner();
    setInterval(inner, intervalTime)
}





const check = async(node, kc) => {
    try{
        const dbTxList = await Transaction.find({confirmationNumber: {$lt: MAX_CONFIRMATION_NUMBER}})
        const len = dbTxList.length
        debug(`number of tx to watch: ${len}`)
        for(let i = 0; i < len; i++){
            const dbTx = dbTxList[i]
            const tx = await node.getTransaction(dbTx.txId)
            const confirmationNumber = tx.confirmations
            if(0 == dbTx.blockNumber){
                const block = await node.getBlockByHash(tx.blockhash)
                dbTx.blockNumber = block.height
                const data = await dbTx.save()
                kc.send(buildMessage(METHOD_TX_WENT_INTO_BLOCK, {
                        txId: data.txId,
                        blockNumber: data.blockNumber,
                    })
                )
            }
            else if(confirmationNumber > dbTx.confirmationNumber){
                debug(`txId: ${dbTx.txId}, confirmationNumber: ${confirmationNumber}`)
                dbTx.confirmationNumber = confirmationNumber
                const data = await dbTx.save()
                kc.send(buildMessage(METHOD_NEW_CONFIRMATION, {
                        txId: data.txId,
                        confirmationNumber: data.confirmationNumber,
                    })
                )
            }
        }
    }
    catch(ex){
        debug(`Error: ${ex}`)
    }
}

run()