extends RefCounted

var events: Array = []
var next_id: int = 1
var limit: int = 240
var archive_path: String = ""

func record(now: int, kind: String, message: String, subjects: Array = [], parents: Array = [], reasons: Dictionary = {}) -> int:
	var event = {"id": next_id, "time": now, "kind": kind, "message": message, "subjects": subjects.duplicate(), "parents": parents.duplicate(), "reasons": reasons.duplicate(true)}
	next_id += 1
	events.append(event)
	if events.size() > limit:
		var old = events.pop_front()
		if not archive_path.is_empty():
			var file = FileAccess.open(archive_path, FileAccess.READ_WRITE) if FileAccess.file_exists(archive_path) else FileAccess.open(archive_path, FileAccess.WRITE)
			if file:
				file.seek_end()
				file.store_line(JSON.stringify(old))
	return event.id

func state() -> Dictionary:
	return {"events": events.duplicate(true), "next_id": next_id}

func restore(data: Dictionary) -> void:
	events = data.events.duplicate(true)
	next_id = data.next_id
