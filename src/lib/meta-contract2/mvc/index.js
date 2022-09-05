const { mvc } = require('../scryptlib');
const Message = require('mvc-lib/message');
const Mnemonic = require('mvc-lib/mnemonic');
const ECIES = require('mvc-lib/ecies');
mvc.Script.Interpreter.MAX_SCRIPT_ELEMENT_SIZE = Number.MAX_SAFE_INTEGER;
mvc.Script.Interpreter.MAXIMUM_ELEMENT_SIZE = Number.MAX_SAFE_INTEGER;
mvc.Message = Message;
mvc.Mnemonic = Mnemonic;
mvc.ECIES = ECIES;
module.exports = mvc;