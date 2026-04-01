const express = require('express');
const multer = require('multer');
const path = require('path');
const negocioController = require('../controllers/negocio.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { createHttpError } = require('../utils/http-error');
const { actualizarNegocioBodySchema } = require('../schemas/negocio.schemas');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extname = path.extname(file.originalname).toLowerCase();
    cb(null, 'logo-' + uniqueSuffix + extname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(createHttpError.badRequest('Solo se permiten imagenes (jpg, jpeg, png, webp)'));
    }
  }
});

router.use(verificarToken);
router.use(esAdmin);

router.get('/', asyncHandler(negocioController.obtenerNegocio));
router.put('/', validate({ body: actualizarNegocioBodySchema }), asyncHandler(negocioController.actualizarNegocio));
router.post('/logo', upload.single('logo'), asyncHandler(negocioController.subirLogo));

module.exports = router;

