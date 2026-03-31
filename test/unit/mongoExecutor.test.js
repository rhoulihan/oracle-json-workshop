import { describe, it, expect, vi } from 'vitest';
import { MongoExecutor } from '../../src/services/mongoExecutor.js';

function mockQueryExecutor(result) {
  return { execute: vi.fn().mockResolvedValue(result) };
}

describe('MongoExecutor', () => {
  describe('parse', () => {
    it('parses db.COLLECTION.find({})', () => {
      const executor = new MongoExecutor();
      const parsed = executor.parse('db.employees.find({})');
      expect(parsed).toEqual({
        collection: 'employees',
        operation: 'find',
        args: [{}],
      });
    });

    it('parses db.COLLECTION.find({name: "Alice"})', () => {
      const executor = new MongoExecutor();
      const parsed = executor.parse('db.employees.find({name: "Alice"})');
      expect(parsed).toEqual({
        collection: 'employees',
        operation: 'find',
        args: [{ name: 'Alice' }],
      });
    });

    it('parses db.COLLECTION.insertOne({...})', () => {
      const executor = new MongoExecutor();
      const parsed = executor.parse('db.products.insertOne({"name": "Widget", "price": 9.99})');
      expect(parsed).toEqual({
        collection: 'products',
        operation: 'insertOne',
        args: [{ name: 'Widget', price: 9.99 }],
      });
    });

    it('parses db.COLLECTION.deleteOne({...})', () => {
      const executor = new MongoExecutor();
      const parsed = executor.parse('db.orders.deleteOne({_id: "abc123"})');
      expect(parsed).toEqual({
        collection: 'orders',
        operation: 'deleteOne',
        args: [{ _id: 'abc123' }],
      });
    });

    it('parses db.COLLECTION.aggregate([...])', () => {
      const executor = new MongoExecutor();
      const parsed = executor.parse('db.sales.aggregate([{$group: {_id: "$region"}}])');
      expect(parsed).toEqual({
        collection: 'sales',
        operation: 'aggregate',
        args: [[{ $group: { _id: '$region' } }]],
      });
    });

    it('parses show collections', () => {
      const executor = new MongoExecutor();
      const parsed = executor.parse('show collections');
      expect(parsed).toEqual({ operation: 'showCollections' });
    });

    it('returns null for unparseable commands', () => {
      const executor = new MongoExecutor();
      expect(executor.parse('not a mongo command')).toBeNull();
    });
  });

  describe('execute', () => {
    it('translates find to SELECT and executes', async () => {
      const qe = mockQueryExecutor({
        rows: [{ DATA: { name: 'Alice' } }],
        columns: ['DATA'],
        rowCount: 1,
        duration: 5,
        resultType: 'json',
      });
      const executor = new MongoExecutor(qe);
      const result = await executor.execute({}, 'db.employees.find({})');

      expect(qe.execute).toHaveBeenCalled();
      const sql = qe.execute.mock.calls[0][1];
      expect(sql).toMatch(/SELECT.*FROM\s+employees/i);
      expect(result.documents).toBeDefined();
      expect(result.count).toBe(1);
    });

    it('translates insertOne to INSERT', async () => {
      const qe = mockQueryExecutor({ rowsAffected: 1, duration: 3, resultType: 'dml' });
      const executor = new MongoExecutor(qe);
      const result = await executor.execute({}, 'db.products.insertOne({"name": "Widget"})');

      const sql = qe.execute.mock.calls[0][1];
      expect(sql).toMatch(/INSERT\s+INTO\s+products/i);
      expect(result.count).toBe(1);
    });

    it('translates deleteOne to DELETE', async () => {
      const qe = mockQueryExecutor({ rowsAffected: 1, duration: 2, resultType: 'dml' });
      const executor = new MongoExecutor(qe);
      await executor.execute({}, 'db.orders.deleteOne({"_id": "abc"})');

      const sql = qe.execute.mock.calls[0][1];
      expect(sql).toMatch(/DELETE\s+FROM\s+orders/i);
    });

    it('translates show collections', async () => {
      const qe = mockQueryExecutor({
        rows: [{ COLLECTION_NAME: 'employees' }, { COLLECTION_NAME: 'products' }],
        columns: ['COLLECTION_NAME'],
        rowCount: 2,
        duration: 1,
        resultType: 'tabular',
      });
      const executor = new MongoExecutor(qe);
      await executor.execute({}, 'show collections');

      const sql = qe.execute.mock.calls[0][1];
      expect(sql).toMatch(/user_soda_collections|user_json_collection/i);
    });

    it('returns error for unparseable commands', async () => {
      const qe = mockQueryExecutor({});
      const executor = new MongoExecutor(qe);
      const result = await executor.execute({}, 'not a command');

      expect(result.error).toBeTruthy();
    });

    it('returns error for aggregate (unsupported)', async () => {
      const qe = mockQueryExecutor({});
      const executor = new MongoExecutor(qe);
      const result = await executor.execute({}, 'db.sales.aggregate([{$group: {_id: "$region"}}])');

      expect(result.error).toMatch(/aggregate.*not.*supported|not.*implemented/i);
    });
  });
});
