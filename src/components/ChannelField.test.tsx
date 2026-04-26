import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelField, type ChannelFieldValue } from "./ChannelField";
import { REFERRAL_CHANNELS } from "@/src/types/registration";

const noop = () => {};

function ControlledHarness({
  initial,
  onSpy,
}: {
  initial: ChannelFieldValue;
  onSpy?: (v: ChannelFieldValue) => void;
}) {
  const [v, setV] = useState<ChannelFieldValue>(initial);
  return (
    <ChannelField
      {...v}
      onChange={(next) => {
        setV(next);
        onSpy?.(next);
      }}
    />
  );
}

describe("ChannelField", () => {
  it("renders all referral channel options from the shared tuple", () => {
    render(
      <ChannelField
        channel=""
        referrerName=""
        channelOther=""
        onChange={noop}
      />,
    );
    const select = screen.getByLabelText(
      /comment avez-vous entendu parler/i,
    ) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    for (const c of REFERRAL_CHANNELS) {
      expect(options).toContain(c);
    }
  });

  it("does not show referrer_name when channel is not 'Recommandation'", () => {
    render(
      <ChannelField
        channel="LinkedIn"
        referrerName=""
        channelOther=""
        onChange={noop}
      />,
    );
    expect(screen.queryByLabelText(/qui vous a recommandé/i)).toBeNull();
  });

  it("shows referrer_name when channel is 'Recommandation'", () => {
    render(
      <ChannelField
        channel="Recommandation"
        referrerName=""
        channelOther=""
        onChange={noop}
      />,
    );
    expect(screen.getByLabelText(/qui vous a recommandé/i)).toBeInTheDocument();
  });

  it("shows channel_other when channel is 'Autre'", () => {
    render(
      <ChannelField
        channel="Autre"
        referrerName=""
        channelOther=""
        onChange={noop}
      />,
    );
    expect(screen.getByLabelText(/précisez/i)).toBeInTheDocument();
  });

  it("emits the new channel through onChange when the select changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChannelField
        channel=""
        referrerName=""
        channelOther=""
        onChange={onChange}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText(/comment avez-vous entendu parler/i),
      "LinkedIn",
    );
    expect(onChange).toHaveBeenCalledWith({
      channel: "LinkedIn",
      referrerName: "",
      channelOther: "",
    });
  });

  it("emits the referrerName through onChange when 'Recommandation' is filled in", async () => {
    const user = userEvent.setup();
    const onSpy = vi.fn();
    render(
      <ControlledHarness
        initial={{ channel: "Recommandation", referrerName: "", channelOther: "" }}
        onSpy={onSpy}
      />,
    );
    await user.type(screen.getByLabelText(/qui vous a recommandé/i), "Alice");
    expect(onSpy).toHaveBeenLastCalledWith({
      channel: "Recommandation",
      referrerName: "Alice",
      channelOther: "",
    });
  });

  it("renders an inline error for the referrerName field", () => {
    render(
      <ChannelField
        channel="Recommandation"
        referrerName=""
        channelOther=""
        onChange={noop}
        errors={{ referrerName: "Champ requis" }}
      />,
    );
    expect(screen.getByText("Champ requis")).toBeInTheDocument();
  });
});
