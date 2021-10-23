import React, { useState, MouseEvent } from "react";
import axios from "axios";
import { useHistory, useLocation } from "react-router-dom";

import msg from "../../common/lib/msg";
import utils from "../../common/lib/utils";
import lnurl from "../../common/lib/lnurl";

import Button from "../components/Button";
import Input from "../components/Form/Input";
import PublisherCard from "../components/PublisherCard";

type Props = {
  details: {
    minSendable: number;
    maxSendable: number;
    callback: string;
    domain: string;
    metadata: string;
  };
  origin: {
    name: string;
    icon: string;
  };
};

function LNURLPay(props: Props) {
  const history = useHistory();
  const location = useLocation();
  const details = props.details || location.state?.details;
  const origin = props.origin || location.state?.origin;
  const [valueMSat, setValueMSat] = useState<string | number>(
    details.minSendable
  );
  const [loading, setLoading] = useState(false);

  async function confirm() {
    try {
      setLoading(true);
      // Get the invoice
      const params = {
        amount: valueMSat, // user specified sum in MilliSatoshi
        // nonce: "", // an optional parameter used to prevent server response caching
        // fromnodes: "", // an optional parameter with value set to comma separated nodeIds if payer wishes a service to provide payment routes starting from specified LN nodeIds
        // comment: "", // an optional parameter to pass the LN WALLET user's comment to LN SERVICE. Note on comment length: GET URL's accept around ~2000 characters for the entire request string. Therefore comment can only be as large as to fit in the URL alongisde any/all of the properties outlined above.*
        // proofofpayer: "", // an optional ephemeral secp256k1 public key generated by payer, a corresponding private key should be retained by payer, a payee may later ask payer to provide a public key itself or sign a random message using corresponding private key and thus provide a proof of payer.
      };
      const { data: paymentInfo } = await axios.get(details.callback, {
        params,
      });
      const { pr: paymentRequest, successAction } = paymentInfo;

      const isValidInvoice = lnurl.verifyInvoice({
        paymentInfo,
        metadata: details.metadata,
        amount: valueMSat,
      });
      if (!isValidInvoice) {
        alert("Payment aborted. Invalid invoice");
        return;
      }

      // LN WALLET pays the invoice, no additional user confirmation is required at this point
      const payment = await utils.call("lnurlPay", {
        message: { origin },
        paymentRequest,
      });

      // Once payment is fulfilled LN WALLET executes a non-null successAction
      // LN WALLET should also store successAction data on the transaction record
      if (successAction && !payment.payment_error) {
        switch (successAction.tag) {
          case "url": // TODO: For url, the wallet should give the user a popup which displays description, url, and a 'open' button to open the url in a new browser tab
            alert(successAction.description);
            if (
              window.confirm(
                `${successAction.description} Do you want to open: ${successAction.url}?`
              )
            ) {
              window.open(successAction.url);
            }
            break;
          case "message":
            utils.notify({
              title: `LNURL response:`,
              message: successAction.message,
            });
            break;
          case "aes": // TODO: For aes, LN WALLET must attempt to decrypt a ciphertext with payment preimage
          default:
            alert(
              `Not implemented yet. Please submit an issue to support success action: ${successAction.tag}`
            );
            break;
        }
      }

      window.close();
    } catch (e) {
      console.log(e);
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function reject(e: MouseEvent) {
    e.preventDefault();
    if (props.details && props.origin) {
      msg.error("User rejected");
    } else {
      history.goBack();
    }
  }

  function renderAmount() {
    if (details.minSendable === details.maxSendable) {
      return <p>{`${details.minSendable / 1000} Satoshi`}</p>;
    } else {
      return (
        <div className="mt-1 flex flex-col">
          <Input
            type="number"
            min={details.minSendable / 1000}
            max={details.maxSendable / 1000}
            value={valueMSat / 1000}
            onChange={(e) => setValueMSat(e.target.value * 1000)}
          />
          <input
            className="mt-2"
            type="range"
            min={details.minSendable}
            max={details.maxSendable}
            step="1000"
            value={valueMSat}
            onChange={(e) => setValueMSat(e.target.value)}
          />
        </div>
      );
    }
  }

  function formattedMetadata() {
    try {
      const metadata = JSON.parse(details.metadata);
      return metadata
        .map(([type, content]: [string, string]) => {
          if (type === "text/plain") {
            return ["Description", content];
          } else if (type === "text/long-desc") {
            return ["Full Description", <p>{content}</p>];
          } else if (["image/png;base64", "image/jpeg;base64"].includes(type)) {
            return [
              "lnurl",
              <img src={`data:${type},${content}`} alt="lnurl" />,
            ];
          }
          return undefined;
        })
        .filter(Boolean);
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  return (
    <div>
      <PublisherCard title={origin.name} image={origin.icon} />
      <div className="p-6">
        <dl className="shadow bg-white pt-4 px-4 rounded-lg mb-6 overflow-hidden">
          {[
            ["Send payment to", details.domain],
            ...formattedMetadata(),
            ["Amount (Satoshi)", renderAmount()],
          ].map(([t, d]) => (
            <>
              <dt className="text-sm font-semibold text-gray-500">{t}</dt>
              <dd className="text-sm mb-4">{d}</dd>
            </>
          ))}
        </dl>
        <div className="text-center">
          <div className="mb-5">
            <Button
              onClick={confirm}
              label="Confirm"
              fullWidth
              primary
              loading={loading}
              disabled={loading}
            />
          </div>

          <p className="mb-3 underline text-sm text-gray-300">
            Only connect with sites you trust.
          </p>

          <a
            className="underline text-sm text-gray-500"
            href="#"
            onClick={reject}
          >
            Cancel
          </a>
        </div>
      </div>
    </div>
  );
}

export default LNURLPay;
