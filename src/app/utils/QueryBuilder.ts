/* eslint-disable @typescript-eslint/no-dynamic-delete */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { excludeField } from "../constants";

export class PrismaQueryBuilder<TWhere = any> {
  public where: TWhere = {} as TWhere;
  public orderBy: any = {};
  public select: any = undefined;
  public skip = 0;
  public take = 10;

  constructor(private readonly query: Record<string, any>) {}

  filter(): this {
    const filter = { ...this.query };

    for (const field of excludeField) {
      delete filter[field];
    }

    this.where = {
      ...this.where,
      ...filter,
    };

    return this;
  }

  search(searchableFields: string[]): this {
    const searchTerm = this.query.searchTerm;

    if (searchTerm) {
      this.where = {
        ...this.where,
        OR: searchableFields.map((field) => ({
          [field]: {
            contains: searchTerm,
            mode: "insensitive",
          },
        })),
      };
    }

    return this;
  }

  sort(): this {
    const sortBy = this.query.sortBy || "createdAt";
    const sortOrder = this.query.sortOrder === "asc" ? "asc" : "desc";

    this.orderBy = {
      [sortBy]: sortOrder,
    };

    return this;
  }

  fields(): this {
    if (this.query.fields) {
      const fieldsArray = this.query.fields.split(",");

      this.select = fieldsArray.reduce((acc: any, field: string) => {
        acc[field] = true;
        return acc;
      }, {});
    }

    return this;
  }

  paginate(): this {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;

    this.skip = (page - 1) * limit;
    this.take = limit;

    return this;
  }

  build() {
    return {
      where: this.where,
      orderBy: this.orderBy,
      select: this.select,
      skip: this.skip,
      take: this.take,
    };
  }

  getMeta(total: number) {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;

    return {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    };
  }
}
