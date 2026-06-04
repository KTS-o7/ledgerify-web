package llm

import (
	"context"
	"log"
	"sync"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Transaction struct {
	ID         pgtype.UUID
	UserID     pgtype.UUID
	Title      pgtype.Text
	CategoryID pgtype.UUID
}

type QueueItem struct {
	TxID   pgtype.UUID
	UserID pgtype.UUID
}

type Queue struct {
	client *Client
	pool   *pgxpool.Pool
	ch     chan QueueItem
	quit   chan struct{}
	wg     sync.WaitGroup
}

func NewQueue(client *Client, pool *pgxpool.Pool, queueSize, workers int) *Queue {
	q := &Queue{
		client: client,
		pool:   pool,
		ch:     make(chan QueueItem, queueSize),
		quit:   make(chan struct{}),
	}
	for i := 0; i < workers; i++ {
		q.wg.Add(1)
		go q.worker()
	}
	return q
}

func (q *Queue) Enqueue(txID, userID pgtype.UUID) {
	item := QueueItem{TxID: txID, UserID: userID}
	select {
	case q.ch <- item:
	default:
		log.Printf("llm queue full, dropping categorize for tx %s", txID.String())
	}
}

func (q *Queue) Shutdown() {
	close(q.quit)
	q.wg.Wait()
}

func (q *Queue) worker() {
	defer q.wg.Done()
	for {
		select {
		case item := <-q.ch:
			q.process(item)
		case <-q.quit:
			return
		}
	}
}

func (q *Queue) process(item QueueItem) {
	ctx := context.Background()

	tx, err := q.getTransaction(ctx, item.TxID)
	if err != nil {
		log.Printf("llm queue: get tx %s: %v", item.TxID, err)
		return
	}
	if tx.CategoryID.Valid {
		return
	}
	title := ""
	if tx.Title.Valid {
		title = tx.Title.String
	}
	if title == "" {
		return
	}

	categories, err := q.getCategories(ctx, item.UserID)
	if err != nil {
		log.Printf("llm queue: get categories for user %s: %v", item.UserID, err)
		return
	}

	categoryName, err := q.client.Categorize(ctx, title, categories)
	if err != nil {
		log.Printf("llm queue: categorize tx %s: %v", item.TxID, err)
		return
	}
	if categoryName == "" {
		return
	}

	for _, cat := range categories {
		if cat.Name == categoryName {
			_, err := q.pool.Exec(ctx,
				"UPDATE transactions SET category_id = $1 WHERE id = $2 AND user_id = $3 AND category_id IS NULL",
				cat.ID, item.TxID, item.UserID)
			if err != nil {
				log.Printf("llm queue: update tx %s: %v", item.TxID, err)
			}
			return
		}
	}
}

func (q *Queue) getTransaction(ctx context.Context, txID pgtype.UUID) (Transaction, error) {
	var tx Transaction
	err := q.pool.QueryRow(ctx,
		"SELECT id, user_id, title, category_id FROM transactions WHERE id = $1 AND deleted_at IS NULL",
		txID).Scan(&tx.ID, &tx.UserID, &tx.Title, &tx.CategoryID)
	return tx, err
}

func (q *Queue) getCategories(ctx context.Context, userID pgtype.UUID) ([]Category, error) {
	rows, err := q.pool.Query(ctx,
		"SELECT id, name FROM categories WHERE (user_id = $1 OR user_id IS NULL) AND deleted_at IS NULL ORDER BY name",
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var cat Category
		if err := rows.Scan(&cat.ID, &cat.Name); err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}
	return categories, rows.Err()
}
