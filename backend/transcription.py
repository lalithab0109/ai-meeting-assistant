import whisper

model = whisper.load_model("base")


def transcribe_audio(audio_path):
    """
    Convert an English meeting recording into a raw transcript.
    """

    result = model.transcribe(
        audio_path,
        language="en"
    )

    return result["text"].strip()


if __name__ == "__main__":
    transcript = transcribe_audio(
        "test_audio/test_meeting.mp4"
    )

    print("\n--- RAW TRANSCRIPT ---\n")
    print(transcript)