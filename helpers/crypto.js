'use strict';

const shityjs = require('shity-js');

function Crypto(scope) {
    this.scope = scope;
    this.network = scope.config.network;
}

Crypto.prototype.makeKeypair = function (seed) {
    return shityjs.crypto.getKeys(seed, this.network);
};

Crypto.prototype.sign = function (hash, keypair) {
    return keypair.sign(hash).toDER().toString("hex");
};

Crypto.prototype.verify = function (hash, signatureBuffer, publicKeyBuffer) {
    try {
        let ecsignature = shityjs.ECSignature.fromDER(signatureBuffer);
        let ecpair = shityjs.ECPair.fromPublicKeyBuffer(publicKeyBuffer, this.network);
        return ecpair.verify(hash, ecsignature);
    } catch (error) {
        return false;
    }
};

module.exports = Crypto;
