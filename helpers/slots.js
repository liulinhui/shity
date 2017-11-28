'use strict';

const constants = require('./constants.js');

/**
 * Get time from Shity epoch.
 * @param {number|undefined} time Time in unix seconds
 * @returns {number}
 */

function beginEpochTime() {
    return constants.epochTime;
}

function getEpochTime(time) {
    if (time === undefined) {
        time = (new Date()).getTime();
    }

    let d = beginEpochTime();
    let t = d.getTime();

    return Math.floor((time - t) / 1000);
}

module.exports = {
    interval: constants.blocktime,
    delegates: constants.activeDelegates,

    getTime: function (time) {
        return getEpochTime(time);
    },

    getRealTime: function (epochTime) {
        if (epochTime === undefined) {
            epochTime = this.getTime();
        }

        let d = beginEpochTime();
        let t = Math.floor(d.getTime() / 1000) * 1000;

        return t + epochTime * 1000;
    },

    getSlotNumber: function (epochTime) {
        if (epochTime === undefined) {
            epochTime = this.getTime();
        }

        return Math.floor(epochTime / this.interval);
    },

    // Forging is allowed only during the first half of blocktime
    isForgingAllowed: function (epochTime) {
        if (epochTime === undefined) {
            epochTime = this.getTime();
        }

        return Math.floor(epochTime / this.interval) === Math.floor((epochTime + this.interval / 2) / this.interval);
    },

    getSlotTime: function (slot) {
        return slot * this.interval;
    },

    getNextSlot: function () {
        let slot = this.getSlotNumber();

        return slot + 1;
    },

    getLastSlot: function (nextSlot) {
        return nextSlot + this.delegates;
    },

    roundTime: function (date) {
        return Math.floor(date.getTime() / 1000) * 1000;
    }
};
