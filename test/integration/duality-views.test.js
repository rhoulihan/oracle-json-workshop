import { describe, it, expect, afterAll } from 'vitest';
import { execute, closePool } from './setup.js';

afterAll(() => closePool());

describe('JSON duality views', () => {
  const EXPECTED_VIEWS = ['CLIENT_PORTFOLIO_DV', 'ADVISOR_BOOK_DV', 'TRANSACTION_FEED_DV'];

  it.each(EXPECTED_VIEWS)('duality view %s exists', async (viewName) => {
    const result = await execute(
      `SELECT view_name FROM user_json_duality_views WHERE view_name = :name`,
      [viewName],
    );
    expect(result.rows).toHaveLength(1);
  });

  it('client_portfolio_dv returns documents with expected shape', async () => {
    const result = await execute(`SELECT data FROM client_portfolio_dv FETCH FIRST 1 ROWS ONLY`);
    expect(result.rows).toHaveLength(1);

    const doc = result.rows[0].DATA;
    expect(doc).toHaveProperty('_id');
    expect(doc).toHaveProperty('firstName');
    expect(doc).toHaveProperty('lastName');
    expect(doc).toHaveProperty('riskProfile');
    expect(doc).toHaveProperty('accounts');
    expect(Array.isArray(doc.accounts)).toBe(true);
  });

  it('advisor_book_dv returns documents with client array', async () => {
    const result = await execute(`SELECT data FROM advisor_book_dv FETCH FIRST 1 ROWS ONLY`);
    expect(result.rows).toHaveLength(1);

    const doc = result.rows[0].DATA;
    expect(doc).toHaveProperty('_id');
    expect(doc).toHaveProperty('firstName');
    expect(doc).toHaveProperty('clients');
    expect(Array.isArray(doc.clients)).toBe(true);
  });

  it('transaction_feed_dv returns documents with unnested account info', async () => {
    const result = await execute(`SELECT data FROM transaction_feed_dv FETCH FIRST 1 ROWS ONLY`);
    expect(result.rows).toHaveLength(1);

    const doc = result.rows[0].DATA;
    expect(doc).toHaveProperty('_id');
    expect(doc).toHaveProperty('txnType');
    expect(doc).toHaveProperty('accountId');
    expect(doc).toHaveProperty('accountType');
  });

  it('client_portfolio_dv holdings are nested under accounts', async () => {
    // Find a client with holdings
    const result = await execute(
      `SELECT data FROM client_portfolio_dv dv
       WHERE JSON_EXISTS(dv.data, '$.accounts[0].holdings[0]')
       FETCH FIRST 1 ROWS ONLY`,
    );
    expect(result.rows).toHaveLength(1);

    const doc = result.rows[0].DATA;
    const holding = doc.accounts[0].holdings[0];
    expect(holding).toHaveProperty('symbol');
    expect(holding).toHaveProperty('quantity');
    expect(holding).toHaveProperty('marketValue');
  });
});
