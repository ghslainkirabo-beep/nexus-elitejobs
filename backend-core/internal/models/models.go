package models

import (
	"time"
)

type Role string

const (
	RoleOwner       Role = "OWNER"
	RoleHR          Role = "HR_MANAGER"
	RoleIT          Role = "IT_SUPPORT"
	RoleHelpdesk    Role = "HELPDESK"
	RoleReceptionist Role = "RECEPTIONIST"
)

type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type AttendanceRecord struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	UserName  string    `json:"user_name"`
	UserRole  Role      `json:"user_role"`
	ScannedAt time.Time `json:"scanned_at"`
	Token     string    `json:"token"`
	Status    string    `json:"status"` // "VERIFIED"
}

type QRToken struct {
	Token     string    `json:"token"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type Report struct {
	ID          string    `json:"id"`
	AuthorID    string    `json:"author_id"`
	AuthorName  string    `json:"author_name"`
	AuthorRole  Role      `json:"author_role"`
	Recipient   Role      `json:"recipient"` // HR_MANAGER or OWNER
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	Metrics     string    `json:"metrics,omitempty"`
	SubmittedAt time.Time `json:"submitted_at"`
}