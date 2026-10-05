from pydantic import BaseModel, ConfigDict, field_validator


class MeetingProcessRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    transcript: str

    @field_validator("transcript")
    @classmethod
    def nonempty_transcript(cls, value):
        if not value.strip():
            raise ValueError("Transcript must not be empty.")
        return value


class MeetingActionItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    task: str
    owner: str | None
    deadline: str | None


class MeetingAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    title: str
    summary: str
    key_points: list[str]
    decisions: list[str]
    action_items: list[MeetingActionItem]


class MeetingResult(MeetingAnalysis):
    refined_transcript: str
