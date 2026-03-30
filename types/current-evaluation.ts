export interface EvaluationRecord {
    // the exam date BAMF is currently evaluating (DD.MM.YYYY)
    examDate: string;
    // ISO date when this was observed (YYYY-MM-DD)
    checkedAt: string;
}

export interface CurrentEvaluation {
    // the latest exam date BAMF is currently evaluating
    examDate: string;
    // ISO datetime of the last sync (e.g. 2026-03-30T13:48:05Z)
    lastSyncAt: string;
    // timeseries of historical evaluation dates
    history: EvaluationRecord[];
}