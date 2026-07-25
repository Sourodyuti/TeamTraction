import asyncio
from playwright.async_api import async_playwright
import json
import time

async def test_pipeline():
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        
        # Open Teacher Dashboard
        teacher_page = await context.new_page()
        
        # Setup console listener for teacher
        teacher_page.on("console", lambda msg: print(f"[Teacher Console] {msg.type}: {msg.text}"))
        
        # Open Student PWA
        student_page = await context.new_page()
        
        # Setup console and WS listener for student
        student_page.on("console", lambda msg: print(f"[Student Console] {msg.type}: {msg.text}"))
        
        student_ws_messages = []
        teacher_ws_messages = []
        
        def handle_student_ws(ws):
            print(f"[Student WS] Connected to {ws.url}")
            ws.on("framesent", lambda payload: print(f"[Student WS SENT] {payload}"))
            ws.on("framereceived", lambda payload: print(f"[Student WS RECV] {payload}"))

        def handle_teacher_ws(ws):
            print(f"[Teacher WS] Connected to {ws.url}")
            ws.on("framesent", lambda payload: print(f"[Teacher WS SENT] {payload}"))
            ws.on("framereceived", lambda payload: print(f"[Teacher WS RECV] {payload}"))
            
        student_page.on("websocket", handle_student_ws)
        teacher_page.on("websocket", handle_teacher_ws)
        
        print("\n=== STEP 1: Setup Teacher & Student Sessions ===")
        # Seed teacher localStorage auth
        await teacher_page.goto("http://localhost:3000/login")
        await teacher_page.evaluate("""() => {
            localStorage.setItem("legilimens_token", "demo_teacher_token");
            localStorage.setItem("legilimens_user", JSON.stringify({
                id: "teacher_demo",
                username: "prof_dumbledore",
                email: "dumbledore@hogwarts.edu",
                role: "teacher",
                full_name: "Albus Dumbledore"
            }));
        }""")
        await teacher_page.goto("http://localhost:3000/dashboard")
        await teacher_page.wait_for_selector('h1:has-text("Marauder")', timeout=10000)
        print("Teacher dashboard loaded.")
        await teacher_page.screenshot(path="dashboard_after_login.png")

        print("\n=== STEP 2: Setup Student PWA ===")
        await student_page.goto("http://localhost:3000/login")
        await student_page.evaluate("""() => {
            localStorage.setItem("legilimens_token", "demo_student_token");
            localStorage.setItem("legilimens_student_id", "student_e2e_test");
            localStorage.setItem("legilimens_user", JSON.stringify({
                id: "student_demo",
                username: "harry_p",
                email: "harry@hogwarts.edu",
                role: "student",
                full_name: "Harry Potter"
            }));
        }""")
        await student_page.goto("http://localhost:3000/muffliato")
        await student_page.wait_for_selector('button:has-text("I\'m lost")', timeout=10000)
        print("Student page loaded.")
        await student_page.screenshot(path="student_page.png")
        print("Student page screenshot saved.")
        
        # Wait a bit for WS connections to establish
        await asyncio.sleep(2)
        
        print("\n=== STEP 3: Trigger 'I'm Lost' Signal ===")
        lost_button = student_page.locator('button:has-text("I\'m lost")')
        
        print("Clicking 'I'm lost' button 1st time...")
        await lost_button.click()
        await asyncio.sleep(1)
        
        print("Clicking 'I'm lost' button 2nd time (to trigger threshold)...")
        await lost_button.click()
        
        # Wait for backend to process (retrieval -> gemini -> TTS)
        print("Waiting 20 seconds for the backend pipeline to complete...")
        await asyncio.sleep(20)
        
        await teacher_page.screenshot(path="dashboard_after_trigger.png")
        print("Dashboard screenshot after trigger saved.")
        
        await browser.close()

asyncio.run(test_pipeline())
