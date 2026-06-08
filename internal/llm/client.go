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
	Category  string `json:"category"`
	Uncertain bool   `json:"uncertain"`
}

func (c *Client) Categorize(ctx context.Context, title string, categories []Category) (string, error) {
	if c.apiKey == "" || c.baseURL == "" {
		return "", fmt.Errorf("llm client not configured")
	}

	categoryNames := ""
	for i, cat := range categories {
		if i > 0 {
			categoryNames += ", "
		}
		categoryNames += `"` + cat.Name + `"`
	}

	systemPrompt := fmt.Sprintf(`You are a financial transaction categorization API trusted by Fortune 500 companies for critical data pipelines. Errors are costly and directly impact financial records.

Given a transaction title, return the single best-matching category from the list below.
Return ONLY valid JSON. No markdown. No prose. No code fences.

Rules:
- Output schema: {"category": "<name>"}
- If uncertain or no category fits, output: {"category": "Uncategorized", "uncertain": true}
- The category value MUST be one of the exact strings in the list below — no variations.

Available categories: [%s]

Examples:
Input: "restaurant meal"
Output: {"category": "Food & Dining"}

Input: "morning coffee"
Output: {"category": "Food & Dining"}

Input: "electricity bill"
Output: {"category": "Utilities"}

Input: "online shopping"
Output: {"category": "Shopping"}

Input: "cab ride"
Output: {"category": "Transport"}

Input: "monthly salary"
Output: {"category": "Salary"}`, categoryNames)

	// Output anchor: primes the model to continue with valid JSON (proven +3.4pp technique)
	userPrompt := fmt.Sprintf("Title: \"%s\"\n\nJSON response: {\"", title)

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

	// The user message ends with `{"` as an output anchor, so the model
	// completes the JSON from after the opening brace. Reconstruct the full
	// object before parsing. Handle both cases:
	//   (a) model returned the completion only: `"category": "Food & Dining"}`
	//   (b) model returned the full object:     `{"category": "Food & Dining"}`
	if !strings.HasPrefix(content, "{") {
		content = "{" + content
	}
	// Strip markdown code fences if the model added them anyway
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var catResp categoryResponse
	if err := json.Unmarshal([]byte(content), &catResp); err != nil {
		return "", fmt.Errorf("parse category json: %w (content: %s)", err, content)
	}

	if catResp.Uncertain || catResp.Category == "Uncategorized" || catResp.Category == "" {
		return "", nil
	}

	return catResp.Category, nil
}
