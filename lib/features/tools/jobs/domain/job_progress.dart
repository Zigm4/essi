/// The three progress states a job can be in. A job with no persisted
/// [JobStatus] row is implicitly [todo]; setting it back to [todo] clears the
/// row. Lives in `domain` so both the filter and the data layer can reference
/// it without a domain->data dependency.
enum JobProgress {
  todo,
  inProgress,
  done;

  /// Wire value stored in the DB and used in the export envelope.
  String get wire {
    switch (this) {
      case JobProgress.todo:
        return 'todo';
      case JobProgress.inProgress:
        return 'in_progress';
      case JobProgress.done:
        return 'done';
    }
  }

  String get label {
    switch (this) {
      case JobProgress.todo:
        return 'Not done';
      case JobProgress.inProgress:
        return 'In progress';
      case JobProgress.done:
        return 'Done';
    }
  }

  /// Parses a stored wire value; unknown/absent values fall back to [todo].
  static JobProgress fromWire(String? wire) {
    switch (wire) {
      case 'in_progress':
        return JobProgress.inProgress;
      case 'done':
        return JobProgress.done;
      default:
        return JobProgress.todo;
    }
  }
}
