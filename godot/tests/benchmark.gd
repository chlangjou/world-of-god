extends SceneTree
const Session = preload("res://scripts/simulation/session.gd")

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var reports: Array = []
	for count in [32, 1000, 10000]:
		var sim = Session.new()
		var setup_start = Time.get_ticks_usec()
		sim.start({"population": count}, 1106)
		var setup_ms = float(Time.get_ticks_usec() - setup_start) / 1000.0
		var days = 90 if count == 32 else 3
		var start = Time.get_ticks_usec()
		sim.advance_by(days * sim.day_seconds())
		var elapsed = maxf(0.000001, float(Time.get_ticks_usec() - start) / 1000000.0)
		var report = {"population_requested": count, "living_population": sim.stats().population, "sim_days": days, "setup_ms": setup_ms, "wall_seconds": elapsed, "sim_days_per_wall_second": days / elapsed, "system_cpu_us": sim.profile_us.duplicate(), "static_memory_bytes_process": OS.get_static_memory_usage(), "scheduler_backlog": sim.scheduler_backlog(), "hot_history_events": sim.history.events.size()}
		reports.append(report)
		print("BENCHMARK: ", JSON.stringify(report))
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var file = FileAccess.open("res://test-output/benchmark.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"engine": Engine.get_version_info(), "ruleset": "mvp0-2", "seed": 1106, "probes": reports}, "\t"))
	quit(0)
