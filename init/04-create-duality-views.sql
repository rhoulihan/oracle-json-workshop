-- 04-create-duality-views.sql
-- Creates JSON Relational Duality Views over the relational schema.

ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = WORKSHOP_ADMIN;

-- Client Portfolio View: client -> accounts -> holdings
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW client_portfolio_dv AS
SELECT JSON {
    '_id'         : c.client_id,
    'firstName'   : c.first_name,
    'lastName'    : c.last_name,
    'email'       : c.email,
    'riskProfile' : c.risk_profile,
    'status'      : c.status,
    'accounts'    : [
        SELECT JSON {
            'accountId'   : a.account_id,
            'accountType' : a.account_type,
            'accountName' : a.account_name,
            'status'      : a.status,
            'holdings'    : [
                SELECT JSON {
                    'holdingId'   : h.holding_id,
                    'symbol'      : h.symbol,
                    'quantity'    : h.quantity,
                    'costBasis'   : h.cost_basis,
                    'marketValue' : h.market_value
                }
                FROM holdings h WITH UPDATE
                WHERE h.account_id = a.account_id
            ]
        }
        FROM accounts a WITH INSERT UPDATE DELETE
        WHERE a.client_id = c.client_id
    ]
}
FROM clients c WITH INSERT UPDATE DELETE;

-- Advisor Book View: advisor -> clients (via mapping table, with UNNEST)
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW advisor_book_dv AS
SELECT JSON {
    '_id'          : adv.advisor_id,
    'firstName'    : adv.first_name,
    'lastName'     : adv.last_name,
    'email'        : adv.email,
    'licenseType'  : adv.license_type,
    'region'       : adv.region,
    'clients'      : [
        SELECT JSON {
            'clientId'     : m.client_id,
            'relationship' : m.relationship,
            UNNEST(
                SELECT JSON {
                    'firstName'   : c.first_name,
                    'lastName'    : c.last_name,
                    'riskProfile' : c.risk_profile,
                    'status'      : c.status
                }
                FROM clients c WITH NOCHECK
                WHERE c.client_id = m.client_id
            )
        }
        FROM advisor_client_map m WITH INSERT UPDATE DELETE
        WHERE m.advisor_id = adv.advisor_id
    ]
}
FROM advisors adv WITH INSERT UPDATE DELETE;

-- Transaction Feed View: transaction with unnested account context
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW transaction_feed_dv AS
SELECT JSON {
    '_id'         : t.txn_id,
    'txnType'     : t.txn_type,
    'symbol'      : t.symbol,
    'quantity'    : t.quantity,
    'price'       : t.price,
    'totalAmount' : t.total_amount,
    'txnDate'     : t.txn_date,
    'notes'       : t.notes,
    UNNEST(
        SELECT JSON {
            'accountId'   : a.account_id,
            'accountType' : a.account_type,
            'accountName' : a.account_name
        }
        FROM accounts a WITH NOCHECK
        WHERE a.account_id = t.account_id
    )
}
FROM transactions t WITH INSERT UPDATE DELETE;

COMMIT;
