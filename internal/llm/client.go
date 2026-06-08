package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Category struct {
	ID   string
	Name string
}

type Client struct {
	baseURL    string
	apiKey     string
	userAgent  string
	model      string
	httpClient *http.Client
}

func NewClient(baseURL, apiKey, model, userAgent string) *Client {
	return &Client{
		baseURL:   baseURL,
		apiKey:    apiKey,
		userAgent: userAgent,
		model:     model,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type categoryResponse struct {
	Category string `json:"category"`
}

func (c *Client) Categorize(ctx context.Context, title string, categories []Category) (string, error) {
	if c.apiKey == "" || c.baseURL == "" {
		return "", fmt.Errorf("llm client not configured")
	}

	categoryList := ""
	for i, cat := range categories {
		if i > 0 {
			categoryList += ", "
		}
		categoryList += fmt.Sprintf(`{"id": "%s", "name": "%s"}`, cat.ID, cat.Name)
	}

	systemPrompt := fmt.Sprintf(`You are a precise financial transaction categorizer. Your accuracy directly impacts someone's financial records — mistakes cause real confusion. Given a transaction title and a list of available categories, return the single best-matching category name. If no category fits, return "Uncategorized".

Available categories:
[%s]`, categoryList)

	userPrompt := fmt.Sprintf(`Title: "%s"`, title)

	reqBody := chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/v1/chat/completions", bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("llm request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("llm returned %d: %s", resp.StatusCode, string(body))
	}

	var chatResp chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	content := strings.TrimSpace(chatResp.Choices[0].Message.Content)

	// Model may return a plain string or a JSON object {"category": "..."}.
	// Try JSON first, fall back to treating the whole content as the category name.
	var category string
	var catResp categoryResponse
	if err := json.Unmarshal([]byte(content), &catResp); err == nil {
		category = strings.TrimSpace(catResp.Category)
	} else {
		// Strip surrounding quotes if the model returned a quoted string
		category = strings.Trim(content, `"`)
	}

	if category == "Uncategorized" || category == "" {
		return "", nil
	}

	return category, nil
}
