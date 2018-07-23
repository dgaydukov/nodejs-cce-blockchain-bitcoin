
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

    getNewAddress(cb){
        client.command("getnewaddress").then((address)=>{
            cb(null, address)
        }).catch(ex=>{
            cb(ex)
        });
    }
    getBalance(address, cb){
        client.getBalance(address, 0).then((balance)=>{
            cb(balance)
        });
    }
    getTotalBalance(cb){
        client.getBalance('*', 0).then((balance)=>{
            cb(balance)
        });
    }
    /**
     * first address of the main account
     */
    getBaseAddress(cb){
        client.command('getaccountaddress', '').then((data)=>{
            cb(data)
        });
    }
    /**
     * the list of all your addresses associated with your main account
     */
    getAddressList(cb){
        client.command('getaddressesbyaccount', '').then((data)=>{
            cb(data)
        });
    }
    sendTransaction(to, amount, cb){
        client.command('sendtoaddress', to, amount).then((txId)=>{
            cb(null, txId)
        }).catch(ex=>{
            cb(ex)
        });
    }
    getPrivateKey(address, cb){
        client.command('dumpprivkey', address).then((privkey)=>{
            cb(privkey)
        });
    }
    getTransaction(txId, cb){
        client.command('getrawtransaction', txId, 1).then((tx)=>{
            cb(null, tx)
        }).catch(ex=>{
            debug(`getrawtransaction ${txId}, error:${ex.message}`)
            cb(ex)
        });
    }
    getBlockByNumber(number, cb){
        client.command('getblockhash', number).then((hash)=>{
            client.command('getblock', hash).then((block)=>{
                cb(null, block)
            }).catch(ex=>{
                cb(ex)
            });
        }).catch(ex=>{
            cb(ex)
        });
    }
    getBlockByHash(hash, cb){
        client.command('getblock', hash).then((block)=>{
            cb(null, block)
        }).catch(ex=>{
            cb(ex)
        });
    }
    getMempoolTxList(cb){
        client.command('getrawmempool').then((list)=>{
            cb(null, list)
        }).catch(ex=>{
            cb(ex)
        });
    }
}









