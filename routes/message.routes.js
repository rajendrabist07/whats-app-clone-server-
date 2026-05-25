import { Router } from 'express';
import { getMessages, sendMessage } from '../controllers/message.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = Router();

router.use(protect);
router.get('/:chatId', getMessages);
router.post('/:chatId', upload.single('media'), sendMessage);

export default router;
