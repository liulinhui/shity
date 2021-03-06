'use strict';

const extend = require('extend');
const util = require('util');

function Sequence(config) {
    let _default = {
        onWarning: null,
        warningLimit: 50
    };
    _default = extend(_default, config);
    let self = this;
    this.sequence = [];

    setImmediate(function nextSequenceTick() {
        if (_default.onWarning && self.sequence.length >= _default.warningLimit) {
            _default.onWarning(self.sequence.length, _default.warningLimit);
        }
        self.__tick(function () {
            setTimeout(nextSequenceTick, 0);
        });
    });
}

//
//__API__ `__tick`

//
Sequence.prototype.__tick = function (cb) {
    let task = this.sequence.shift();
    if (!task) {
        return setImmediate(cb);
    }
    let args = [function (err, res) {
        if (task.done) {
            task.done(err, res);
        }
        setImmediate(cb);
    }];
    if (task.args) {
        args = args.concat(task.args);
    }
    task.worker.apply(task.worker, args);
};

//
//__API__ `add`

//
Sequence.prototype.add = function (worker, args, done) {
    if (!done && args && typeof(args) === 'function') {
        done = args;
        args = undefined;
    }
    if (worker && typeof(worker) === 'function') {
        let task = {worker: worker, done: done};
        if (util.isArray(args)) {
            task.args = args;
        }
        this.sequence.push(task);
    }
};

//
//__API__ `count`

//
Sequence.prototype.count = function () {
    return this.sequence.length;
};

module.exports = Sequence;
