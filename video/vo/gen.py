import asyncio, json, os, sys, edge_tts
S=json.load(open("script.json",encoding="utf-8"))
VOICE="en-US-AndrewMultilingualNeural"
async def one(k,txt):
    for a in range(6):
        try:
            c=edge_tts.Communicate(txt,VOICE,rate="-3%")
            await asyncio.wait_for(c.save(k+".mp3"),60)
            if os.path.getsize(k+".mp3")>5000: return True
        except Exception as e:
            print(k,"retry",a,type(e).__name__)
        await asyncio.sleep(2)
    return False
async def main():
    for k,v in S.items():
        if os.path.exists(k+".mp3") and os.path.getsize(k+".mp3")>5000 and "--force" not in sys.argv: continue
        print(k, await one(k,v))
asyncio.run(main())
