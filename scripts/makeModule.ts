import fs from "fs";
import path from "path";

const moduleName = process.argv[2];

if (!moduleName) {
  console.log("❌ Please provide module name");
  process.exit(1);
}

const basePath = path.join(
  __dirname,
  "../src/app/modules",
  moduleName
);

if (fs.existsSync(basePath)) {
  console.log("❌ Module already exists");
  process.exit(1);
}

fs.mkdirSync(basePath, { recursive: true });

const capitalized =
  moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

const files: Record<string, string> = {
  [`${moduleName}.controller.ts`]: `
import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ${capitalized}Service } from "./${moduleName}.service";

const create${capitalized} = catchAsync(async (req: Request, res: Response) => {
  const result = await ${capitalized}Service.create${capitalized}(req);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "${moduleName} created successfully",
    data: result,
  });
});

export const ${capitalized}Controller = {
  create${capitalized},
};
`.trim(),

  [`${moduleName}.service.ts`]: `
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Request } from "express";

const create${capitalized} = async (req: Request) => {
  return "${moduleName} create successfully";
};

export const ${capitalized}Service = {
  create${capitalized},
};
`.trim(),

  [`${moduleName}.route.ts`]: `
import { Router } from "express";
import { ${capitalized}Controller } from "./${moduleName}.controller";

const router = Router();

router.post("/", ${capitalized}Controller.create${capitalized});

export default router;
`.trim(),
};

for (const fileName in files) {
  fs.writeFileSync(
    path.join(basePath, fileName),
    files[fileName]
  );
}

console.log(`✅ ${moduleName} module created successfully`);
