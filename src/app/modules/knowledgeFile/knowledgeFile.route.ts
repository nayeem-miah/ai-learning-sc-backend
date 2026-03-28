import { Router } from 'express';
import { KnowledgeFileController } from './knowledgeFile.controller';
import validateRequest from '../../middlewares/validateRequest';
import { KnowledgeFileValidation } from './knowledgeFile.validation';
import { fileUpload } from '../../utils/fileUpload';

const router = Router();

router.get('/', KnowledgeFileController.getAllKnowledgeFiles);
router.get('/:id', KnowledgeFileController.getSingleKnowledgeFile);

router.post(
  '/',
  fileUpload.upload.single('file'),
  KnowledgeFileController.createKnowledgeFile,
);

router.patch(
  '/:id',
  validateRequest(KnowledgeFileValidation.updateKnowledgeFileZodSchema),
  KnowledgeFileController.updateKnowledgeFile,
);

router.delete('/:id', KnowledgeFileController.deleteKnowledgeFile);

export const KnowledgeFileRoutes = router;