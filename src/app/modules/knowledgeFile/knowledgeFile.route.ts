import { Role } from '@prisma/client';
import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { fileUpload } from '../../utils/fileUpload';
import { KnowledgeFileController } from './knowledgeFile.controller';
import { KnowledgeFileValidation } from './knowledgeFile.validation';

const router = Router();

router.get('/', KnowledgeFileController.getAllKnowledgeFiles);
router.get('/:id', KnowledgeFileController.getSingleKnowledgeFile);

router.post(
  '/',
  auth(Role.ADMIN),
  fileUpload.upload.single('file'),
  KnowledgeFileController.createKnowledgeFile,
);

router.patch(
  '/:id',
  auth(Role.ADMIN),
  validateRequest(KnowledgeFileValidation.updateKnowledgeFileZodSchema),
  KnowledgeFileController.updateKnowledgeFile,
);

router.delete(
  '/:id',
  auth(Role.ADMIN),
  KnowledgeFileController.deleteKnowledgeFile,
);

export const KnowledgeFileRoutes = router;
