import * as mvc from '../mvc';
import { CodeError, ErrCode } from '../common/error';
import { Net } from '../net';
import {
  API_NET,
  AuthorizationOption,
  FungibleTokenBalance,
  FungibleTokenSummary,
  FungibleTokenUnspent,
  NonFungibleTokenSummary,
  NonFungibleTokenUnspent,
  SA_utxo,
  ApiBase,
} from './index';
type ResData = {
  code: number;
  data: any;
  msg: string;
};

export class MVC implements ApiBase {
  serverBase: string;
  authorization: string;
  privateKey: any;
  publicKey: any;
  constructor(apiNet: API_NET, serverBase?: string) {
    if (apiNet == API_NET.MAIN) {
      this.serverBase = 'https://api-mvc.metasv.com';
    } else {
      throw new CodeError(ErrCode.EC_SENSIBLE_API_ERROR, 'MetaSV-MVC only support mainnet');
    }
    if (serverBase) {
      this.serverBase = serverBase;
    }
  }

  public authorize(options: AuthorizationOption) {
    const { authorization, privateKey } = options;

    if (authorization) {
      if (authorization.indexOf('Bearer') != 0) {
        this.authorization = `Bearer ${authorization}`;
      } else {
        this.authorization = authorization;
      }
    } else {
      //https://github.com/metasv/metasv-client-signature
      this.privateKey = new mvc.PrivateKey(privateKey);
      this.publicKey = this.privateKey.toPublicKey();
    }
  }

  private _getHeaders(path: string) {
    let headers = {};
    if (this.authorization) {
      headers = { authorization: this.authorization };
    } else if (this.privateKey) {
      const timestamp = Date.now();
      const nonce = Math.random().toString().substring(2, 12);
      const message = path + '_' + timestamp + '_' + nonce;
      const hash = mvc.crypto.Hash.sha256(Buffer.from(message));
      const sig = mvc.crypto.ECDSA.sign(hash, this.privateKey);
      const sigEncoded = sig.toBuffer().toString('base64');

      headers = {
        'MetaSV-Timestamp': timestamp,
        'MetaSV-Client-Pubkey': this.publicKey.toHex(),
        'MetaSV-Nonce': nonce,
        'MetaSV-Signature': sigEncoded,
      };
    } else {
      throw new CodeError(ErrCode.EC_SENSIBLE_API_ERROR, 'MetaSV should be authorized to access api.');
    }
    return headers;
  }

  /**
   * @param {string} address
   */
  public async getUnspents(address: string): Promise<SA_utxo[]> {
    let path = `/address/${address}/utxo`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(
      url,
      {},
      {
        headers: this._getHeaders(path),
      }
    );

    let ret: SA_utxo[] = _res.map((v: any) => ({
      txId: v.txid,
      outputIndex: v.outIndex,
      satoshis: v.value,
      address: address,
    }));
    return ret;
  }

  /**
   * @param {string} hex
   */
  public async broadcast(hex: string): Promise<string> {
    let path = `/tx/broadcast`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpPost(
      url,
      {
        hex,
      },
      {
        headers: this._getHeaders(path),
      }
    );

    if (!_res.txid) {
      console.log(`???????????????${_res.message.toString()}`);
    }
    return _res;
  }

  /**
   * @param {string} txid
   */
  public async getRawTxData(txid: string): Promise<string> {
    let path = `/tx/${txid}/raw`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(
      url,
      {},
      {
        headers: this._getHeaders(path),
      }
    );
    return _res.hex;
  }

  /**
   * ??????FT??????CodeHash+??????genesis??????????????????utxo??????
   */
  public async getFungibleTokenUnspents(
    codehash: string,
    genesis: string,
    address: string,
    size: number = 10
  ): Promise<FungibleTokenUnspent[]> {
    let path = `/sensible/ft/address/${address}/utxo`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(
      url,
      {
        codeHash: codehash,
        genesis,
      },
      {
        headers: this._getHeaders(path),
      }
    );

    let ret: FungibleTokenUnspent[] = _res.map((v) => ({
      txId: v.txid,
      outputIndex: v.txIndex,
      tokenAddress: address,
      tokenAmount: v.valueString,
    }));
    return ret;
  }

  /**
   * ????????????????????????FT?????????
   */
  public async getFungibleTokenBalance(
    codehash: string,
    genesis: string,
    address: string
  ): Promise<FungibleTokenBalance> {
    let path = `/sensible/ft/address/${address}/balance`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(url, { codeHash: codehash, genesis }, { headers: this._getHeaders(path) });

    let ret: FungibleTokenBalance = {
      balance: '0',
      pendingBalance: '0',
      utxoCount: 0,
      decimal: 0,
    };
    if (_res.length > 0) {
      ret = {
        balance: _res[0].confirmedString,
        pendingBalance: _res[0].unconfirmedString,
        utxoCount: _res[0].utxoCount,
        decimal: _res[0].decimal,
      };
    }
    return ret;
  }

  /**
   * ?????????????????????FT Token?????????????????????token?????????
   */
  public async getFungibleTokenSummary(address: string): Promise<FungibleTokenSummary[]> {
    let path = `/sensible/ft/address/${address}/balance`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(url, {}, { headers: this._getHeaders(path) });

    let data: FungibleTokenSummary[] = [];
    _res.forEach((v: any) => {
      data.push({
        codehash: v.codeHash,
        genesis: v.genesis,
        sensibleId: v.sensibleId,
        symbol: v.symbol,
        decimal: v.decimal,
        balance: v.confirmedString,
        pendingBalance: v.unconfirmedString,
      });
    });

    return data;
  }

  /**
   * ??????NFT??????CodeHash+??????genesis??????????????????utxo??????
   */
  public async getNonFungibleTokenUnspents(
    codehash: string,
    genesis: string,
    address: string,
    cursor: number = 0,
    size: number = 20
  ): Promise<NonFungibleTokenUnspent[]> {
    let path = `/sensible/nft/address/${address}/utxo`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(url, { codeHash: codehash, genesis }, { headers: this._getHeaders(path) });

    let ret: NonFungibleTokenUnspent[] = _res.map((v) => ({
      txId: v.txid,
      outputIndex: v.txIndex,
      tokenAddress: address,
      tokenIndex: v.tokenIndex,
      metaTxId: v.metaTxid,
      metaOutputIndex: v.metaOutputIndex,
    }));
    return ret;
  }

  /**
   * ????????????????????????NFT???UTXO
   */
  public async getNonFungibleTokenUnspentDetail(codehash: string, genesis: string, tokenIndex: string) {
    let path = `/sensible/nft/genesis/${codehash}/${genesis}/utxo`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(url, { tokenIndex }, { headers: this._getHeaders(path) });

    let ret = _res.map((v) => ({
      txId: v.txid,
      outputIndex: v.txIndex,
      tokenAddress: v.address,
      tokenIndex: v.tokenIndex,
      metaTxId: v.metaTxid,
      metaOutputIndex: v.metaOutputIndex,
    }))[0];
    return ret;
  }

  /**
   * ???????????????????????????NFT Token????????????????????????nft????????????
   * @param {String} address
   * @returns
   */
  public async getNonFungibleTokenSummary(address: string): Promise<NonFungibleTokenSummary[]> {
    let url = `https://api.sensiblequery.com/nft/summary/${address}`;
    let _res = await Net.httpGet(url, {});
    const { code, data, msg } = _res as ResData;
    if (code != 0) {
      throw new CodeError(ErrCode.EC_SENSIBLE_API_ERROR, `request api failed. [url]:${url} [msg]:${msg}`);
    }

    let ret: NonFungibleTokenSummary[] = [];
    data.forEach((v) => {
      ret.push({
        codehash: v.codehash,
        genesis: v.genesis,
        sensibleId: v.sensibleId,
        count: v.count,
        pendingCount: v.pendingCount,
        metaTxId: v.metaTxId,
        metaOutputIndex: v.metaOutputIndex,
        supply: v.supply,
      });
    });
    return ret;
  }

  public async getBalance(address: string) {
    let path = `/address/${address}/balance`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(
      url,
      {},
      {
        headers: this._getHeaders(path),
      }
    );
    return {
      balance: _res.confirmed,
      pendingBalance: _res.unconfirmed,
    };
  }

  public async getNftSellUtxo(codehash: string, genesis: string, tokenIndex: string) {
    let path = `/sensible/nft/sell/genesis/${codehash}/${genesis}/utxo`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(url, { tokenIndex }, { headers: this._getHeaders(path) });

    let ret = _res
      .filter((v) => v.isReady == true)
      .map((v) => ({
        codehash,
        genesis,
        tokenIndex,
        txId: v.txid,
        outputIndex: v.txIndex,
        sellerAddress: v.address,
        satoshisPrice: v.price,
      }))[0];
    return ret;
  }

  public async getNftSellList(codehash: string, genesis: string, cursor: number = 0, size: number = 20) {
    let path = `/sensible/nft/sell/genesis/${codehash}/${genesis}/utxo`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(url, {}, { headers: this._getHeaders(path) });

    let ret = _res
      .filter((v) => v.isReady == true)
      .map((v) => ({
        codehash,
        genesis,
        tokenIndex: v.tokenIndex,
        txId: v.txid,
        outputIndex: v.txIndex,
        sellerAddress: v.address,
        satoshisPrice: v.price,
      }))[0];
    return ret;
  }

  public async getNftSellListByAddress(address: string, cursor: number = 0, size: number = 20) {
    let path = `/sensible/nft/sell/address/${address}/utxo`;
    let url = this.serverBase + path;
    let _res: any = await Net.httpGet(url, {}, { headers: this._getHeaders(path) });
    let ret = _res
      // .filter((v) => v.isReady == true)
      .map((v) => ({
        codehash: v.codeHash,
        genesis: v.genesis,
        tokenIndex: v.tokenIndex,
        txId: v.txid,
        outputIndex: v.txIndex,
        sellerAddress: v.address,
        satoshisPrice: v.price,
      }));
    return ret;
  }

  public async getOutpointSpent(txId: string, index: number) {
    let url = `https://api.sensiblequery.com/tx/${txId}/out/${index}/spent`;
    let _res = await Net.httpGet(url, {});
    const { code, data, msg } = _res as ResData;
    if (code != 0) {
      return null;
    }
    if (!data) return null;
    return {
      spentTxId: data.txid,
      spentInputIndex: data.idx,
    };
  }
}
