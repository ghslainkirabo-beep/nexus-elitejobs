package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/ghslainkirabo-beep/nexus-elitejobs/backend/internal/models"
	"github.com/ghslainkirabo-beep/nexus-elitejobs/backend/internal/qr"
	"github.com/ghslainkirabo-beep/nexus-elitejobs/backend/internal/websocket"
	gorillaWS "github.com/gorilla/websocket"
)

var (
	qrMgr       *qr.QRManager
	hub         *websocket.Hub
	records     []*models.AttendanceRecord
	reports     []*models.Report
	upgrader    = gorillaWS.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
)

func CORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func main() {
	qrMgr = qr.NewQRManager("NEXUS_ELITEJOBS_SUPER_SECRET_KEY")
	qrMgr.GenerateDailyToken()

	hub = websocket.NewHub()
	go hub.Run()

	http.HandleFunc("/api/qr/generate", CORS(handleGenerateQR))
	http.HandleFunc("/api/qr/current", CORS(handleGetCurrentQR))
	http.HandleFunc("/api/attendance/scan", CORS(handleScanAttendance))
	http.HandleFunc("/api/attendance/records", CORS(handleGetAttendance))
	http.HandleFunc("/api/reports/submit", CORS(handleSubmitReport))
	http.HandleFunc("/api/reports", CORS(handleGetReports))
	http.HandleFunc("/ws", handleWS)

	port := ":8080"
	fmt.Printf("[NEXUS-CORE] System Active on http://localhost%s\n", port)
	log.Fatal(http.ListenAndServe(port, nil))
}

func handleGenerateQR(w http.ResponseWriter, r *http.Request) {
	token := qrMgr.GenerateDailyToken()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(token)
}

func handleGetCurrentQR(w http.ResponseWriter, r *http.Request) {
	token := qrMgr.GetCurrentToken()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(token)
}

func handleScanAttendance(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID   string      `json:"user_id"`
		UserName string      `json:"user_name"`
		Role     models.Role `json:"role"`
		Token    string      `json:"token"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	record, err := qrMgr.ValidateAndRecordAttendance(req.UserID, req.UserName, req.Role, req.Token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	records = append(records, record)

	// Live push event to Admin/Owner
	hub.BroadcastToRole("OWNER", websocket.Event{
		Type:    "ATTENDANCE_VERIFIED",
		Payload: record,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(record)
}

func handleGetAttendance(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(records)
}

func handleSubmitReport(w http.ResponseWriter, r *http.Request) {
	var rep models.Report
	if err := json.NewDecoder(r.Body).Decode(&rep); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	rep.ID = fmt.Sprintf("REP-%d", time.Now().UnixNano())
	rep.SubmittedAt = time.Now()
	reports = append(reports, &rep)

	targetRole := string(rep.Recipient)
	hub.BroadcastToRole(targetRole, websocket.Event{
		Type:    "NEW_REPORT",
		Payload: rep,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rep)
}

func handleGetReports(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reports)
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	role := r.URL.Query().Get("role")
	userID := r.URL.Query().Get("user_id")

	client := &websocket.Client{
		ID:   userID,
		Role: role,
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	hub.Register(client)

	go func() {
		defer func() {
			hub.Unregister(client)
			conn.Close()
		}()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()

	go func() {
		defer conn.Close()
		for msg := range client.Send {
			conn.WriteMessage(gorillaWS.TextMessage, msg)
		}
	}()
}