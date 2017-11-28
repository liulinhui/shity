'use strict';

module.exports = {
    reverse: function (diff) {
        let copyDiff = diff.slice();
        for (let i = 0; i < copyDiff.length; i++) {
            let math = copyDiff[i][0] === '-' ? '+' : '-';
            copyDiff[i] = math + copyDiff[i].slice(1);
        }
        return copyDiff;
    },

    merge: function (source, diff) {
        let res = source ? source.slice() : [];
        let index;

        for (let i = 0; i < diff.length; i++) {
            let math = diff[i][0];
            let publicKey = diff[i].slice(1);

            if (math === '+') {
                res = res || [];

                index = -1;
                if (res) {
                    index = res.indexOf(publicKey);
                }
                if (index !== -1) {
                    return false;
                }

                res.push(publicKey);
            }
            if (math === '-') {
                index = -1;
                if (res) {
                    index = res.indexOf(publicKey);
                }
                if (index === -1) {
                    return false;
                }
                res.splice(index, 1);
                if (!res.length) {
                    res = null;
                }
            }
        }
        return res;
    }
};
