import { Router } from 'express';
import { createGroupChat, createOrGetOneToOneChat, getChats } from '../controllers/chat.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);
router.get('/', getChats);
router.post('/', createOrGetOneToOneChat);
router.post('/group', createGroupChat);

export default router;
