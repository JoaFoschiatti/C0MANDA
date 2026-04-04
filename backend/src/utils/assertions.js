const { createHttpError } = require('./http-error');

const assertExists = (item, entityName) => {
  if (!item) {
    throw createHttpError.notFound(`${entityName} no encontrado`);
  }
  return item;
};

module.exports = { assertExists };
