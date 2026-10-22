package qr

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/ghslainkirabo-beep/nexus-elitejobs/backend/internal/models"
)

type QRManager struct {
	secretKey     string
	currentToken  *models.QRToken
	mu            sync.RWMutex
	usedTokenLogs map[string]map[string]bool // map[date]map[userID]bool
}

func NewQRManager(secret string) *QRManager {
	return &QRManager{
		secretKey:     secret,
		usedTokenLogs: make(map[string]map[string]bool),
	}
}

func (m *QRManager) GenerateDailyToken() *models.QRToken {
	m.mu.Lock()
	defer m.mu.Unlock()

	today := time.Now().Format("2006-01-02")
	h := hmac.New(sha256.New, []byte(m.secretKey))
	h.Write([]byte(fmt.Sprintf("ELITEJOBS_BK_ARENA_%s", today)))
	tokenStr := hex.EncodeToString(h.Sum(nil))

	m.currentToken = &models.QRToken{
		Token:     tokenStr,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	return m.currentToken
}

func (m *QRManager) GetCurrentToken() *models.QRToken {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.currentToken == nil {
		return nil
	}
	return m.currentToken
}

func (m *QRManager) ValidateAndRecordAttendance(userID, userName string, role models.Role, scannedToken string) (*models.AttendanceRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.currentToken == nil || m.currentToken.Token != scannedToken {
		return nil, fmt.Errorf("invalid or expired QR Code for today")
	}

	today := time.Now().Format("2006-01-02")
	if m.usedTokenLogs[today] == nil {
		m.usedTokenLogs[today] = make(map[string]bool)
	}

	if m.usedTokenLogs[today][userID] {
		return nil, fmt.Errorf("attendance already logged for today")
	}

	m.usedTokenLogs[today][userID] = true

	record := &models.AttendanceRecord{
		ID:        fmt.Sprintf("ATT-%d", time.Now().UnixNano()),
		UserID:    userID,
		UserName:  userName,
		UserRole:  role,
		ScannedAt: time.Now(),
		Token:     scannedToken,
		Status:    "VERIFIED",
	}

	return record, nil
}