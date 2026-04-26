import { REFERRAL_CHANNELS, type ReferralChannel } from "@/src/types/registration";

export interface ChannelFieldValue {
  channel: ReferralChannel | "";
  referrerName: string;
  channelOther: string;
}

interface ChannelFieldErrors {
  channel?: string;
  referrerName?: string;
  channelOther?: string;
}

interface ChannelFieldProps extends ChannelFieldValue {
  onChange: (value: ChannelFieldValue) => void;
  errors?: ChannelFieldErrors;
  required?: boolean;
}

export function ChannelField({
  channel,
  referrerName,
  channelOther,
  onChange,
  errors,
  required,
}: ChannelFieldProps) {
  const emit = (next: Partial<ChannelFieldValue>) =>
    onChange({ channel, referrerName, channelOther, ...next });

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="referral_channel"
          className="block text-sm font-medium text-slate-800"
        >
          Comment avez-vous entendu parler de ce séminaire ?
          {required && <span aria-hidden className="ml-1 text-red-600">*</span>}
        </label>
        <select
          id="referral_channel"
          name="referral_channel"
          value={channel}
          required={required}
          onChange={(e) => {
            const next = e.target.value as ReferralChannel | "";
            emit({
              channel: next,
              referrerName: next === "Recommandation" ? referrerName : "",
              channelOther: next === "Autre" ? channelOther : "",
            });
          }}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Sélectionnez —</option>
          {REFERRAL_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {errors?.channel && (
          <p className="mt-1 text-sm text-red-600">{errors.channel}</p>
        )}
      </div>

      {channel === "Recommandation" && (
        <div>
          <label
            htmlFor="referrer_name"
            className="block text-sm font-medium text-slate-800"
          >
            Qui vous a recommandé ?
            <span aria-hidden className="ml-1 text-red-600">*</span>
          </label>
          <input
            id="referrer_name"
            name="referrer_name"
            type="text"
            value={referrerName}
            onChange={(e) => emit({ referrerName: e.target.value })}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Prénom et nom"
          />
          {errors?.referrerName && (
            <p className="mt-1 text-sm text-red-600">{errors.referrerName}</p>
          )}
        </div>
      )}

      {channel === "Autre" && (
        <div>
          <label
            htmlFor="channel_other"
            className="block text-sm font-medium text-slate-800"
          >
            Précisez :<span aria-hidden className="ml-1 text-red-600">*</span>
          </label>
          <input
            id="channel_other"
            name="channel_other"
            type="text"
            value={channelOther}
            onChange={(e) => emit({ channelOther: e.target.value })}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors?.channelOther && (
            <p className="mt-1 text-sm text-red-600">{errors.channelOther}</p>
          )}
        </div>
      )}
    </div>
  );
}
