const mockData = {
    patients: [
        {
            id: 1,
            fullName: "Maria Silva",
            phone: "(14) 99999-1111",
            email: "maria@email.com"
        },
        {
            id: 2,
            fullName: "João Santos",
            phone: "(14) 99999-2222",
            email: "joao@email.com"
        },
        {
            id: 3,
            fullName: "Ana Oliveira",
            phone: "(14) 99999-3333",
            email: "ana@email.com"
        }
    ],

    appointments: [
        {
            id: 1,
            patientName: "Maria Silva",
            startsAt: "2026-06-15T09:00:00",
            status: "CONFIRMED"
        },
        {
            id: 2,
            patientName: "João Santos",
            startsAt: "2026-06-16T14:00:00",
            status: "SCHEDULED"
        }
    ],

    payments: [
        {
            id: 1,
            patientName: "Maria Silva",
            amount: 150,
            dueDate: "2026-06-20",
            status: "PAID"
        },
        {
            id: 2,
            patientName: "João Santos",
            amount: 200,
            dueDate: "2026-06-25",
            status: "PENDING"
        }
    ],

    documents: [
        {
            id: 1,
            patientName: "Maria Silva",
            title: "Relatório Inicial",
            type: "REPORT",
            updatedAt: "2026-06-14T10:00:00"
        }
    ],

    financeSummary: {
        received: 150,
        pending: 200,
        overdue: 0,
        paidCount: 1,
        pendingCount: 1,
        overdueCount: 0
    }
};