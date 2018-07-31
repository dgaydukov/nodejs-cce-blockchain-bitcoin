
const debug = require("debug")("blockchain")
import {default as config} from "@root/config.json"
const Client = require('bitcoin-core');
const client = new Client({
    host: config.BITCOIN_NODE_HOST,
    port: config.BITCOIN_NODE_PORT,
    username: config.BITCOIN_NODE_RPC_USERNAME,
    password: config.BITCOIN_NODE_RPC_PASSWORD,
    timeout: 30000
});

export class BitcoinNode{
    constructor(){

    }

    getNewAddress(){
        return client.command("getnewaddress")
    }
    getBalance(address){
        return client.getBalance(address, 0)
    }
    getTotalBalance(){
        return client.getBalance('*', 0)
    }
    /**
     * first address of the main account
     */
    getBaseAddress(){
        return client.command('getaccountaddress', '')
    }
    /**
     * the list of all your addresses associated with your main account
     */
    getAddressList(){
        return client.command('getaddressesbyaccount', '')
    }
    sendTransaction(to, amount){
        return client.command('sendtoaddress', to, amount)
    }
    getPrivateKey(address){
        return client.command('dumpprivkey', address)
    }
    getTxById(txId){
        return client.command('getrawtransaction', txId, 1)
    }
    getBlockByHash(hash){
        return client.command('getblock', hash)
    }
    getBlockByNumber(number){
        return new Promise((resolve, reject)=>{
            client.command('getblockhash', number).then((hash)=>{
                client.command('getblock', hash).then((block)=>{
                    resolve(block)
                })
            })
        })
    }
    getMempoolTxList(){
        return client.command('getrawmempool')
    }
}









