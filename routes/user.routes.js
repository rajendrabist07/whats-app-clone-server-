import { Router } from 'express';
import { getCurrentUser, searchUsers } from '../controllers/user.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);
router.get('/me', getCurrentUser);
router.get('/search', searchUsers);

export default router;
