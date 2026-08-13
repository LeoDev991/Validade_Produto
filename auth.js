const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function verifyPassword(inputPassword, storedHash) {
  return hashPassword(inputPassword) === storedHash;
}

module.exports = { hashPassword, verifyPassword };
